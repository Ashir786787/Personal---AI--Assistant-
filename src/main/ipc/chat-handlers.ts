import { ipcMain, type WebContents } from 'electron'
import { IPC } from '@shared/ipc'
import type { SendChatRequest, StreamEvent } from '@shared/chat'
import type { ProviderId } from '@shared/providers'
import { TOOL_PROTOCOL_INSTRUCTIONS } from '@shared/tools'
import { getApiKey } from '../settings/store'
import type { ConversationMemory } from '../conversation/memory'
import { SYSTEM_PROMPT } from '../conversation/persona'
import { ProviderError } from '../llm/errors'
import type { ChatTurn } from '../llm/provider'
import type { ProviderRouter } from '../llm/router'
import type { ToolRegistry } from '../tools/registry'
import { extractToolAction } from '../tools/parse'
import { getProposal, resolveProposal, type PendingProposal } from '../tools/proposals'
import { executeOrganizationPlan } from '../fs/executor'
import { setVolume, toggleMute } from '../system/volume'
import { setBrightness } from '../system/brightness'
import { launchApp } from '../system/apps'
import { addRoutine } from '../routines/store'
import { NUDGE_MESSAGE, shouldNudge } from '../tools/nudge'
import { log } from '../lib/logger'

const MAX_INPUT_LENGTH = 8000
const PROVIDER_TIMEOUT_MS = 45_000
const MAX_TOOL_HOPS = 6

const CUTOFF_MARKER = '[my previous answer was cut off mid-sentence]'
const BUDGET_LINE =
  'I\'ve used my step budget for this request and stopped safely. Say "continue" and I\'ll pick up where I left off'

export class ValidationError extends Error {}

function parseRequest(raw: unknown): SendChatRequest {
  if (typeof raw !== 'object' || raw === null || !('text' in raw)) {
    throw new ValidationError('Malformed request')
  }
  const text = String((raw as SendChatRequest).text).trim()
  if (text.length === 0) throw new ValidationError('Message is empty')
  if (text.length > MAX_INPUT_LENGTH) {
    throw new ValidationError(`Message too long (${text.length} chars, max ${MAX_INPUT_LENGTH})`)
  }
  return { text }
}

export function registerChatIpc(
  webContents: WebContents,
  router: ProviderRouter,
  memory: ConversationMemory,
  registry: ToolRegistry
): void {
  let active: AbortController | null = null

  const emit = (event: StreamEvent): void => {
    if (!webContents.isDestroyed()) webContents.send(IPC.chatStream, event)
  }

  ipcMain.handle(IPC.chatSend, async (_event, raw: unknown) => {
    const request = parseRequest(raw)

    if (active) active.abort()
    const controller = new AbortController()
    active = controller

    const userMessage = memory.append('user', request.text)
    const turns: ChatTurn[] = [
      { role: 'system', content: `${SYSTEM_PROMPT}\n\n${TOOL_PROTOCOL_INSTRUCTIONS}` },
      ...memory.recent().map((m) => ({ role: m.role, content: m.content }) as ChatTurn)
    ]

    void streamResponse(router, memory, registry, turns, controller, emit, request.text)
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : 'Something went wrong on my side. Try again'
        emit({ type: 'error', message, recoverable: true })
        log('error', 'chat', message)
      })
      .finally(() => {
        if (active === controller) active = null
      })

    return { userMessageId: userMessage.id }
  })

  ipcMain.on(IPC.chatCancel, () => {
    active?.abort()
  })

  ipcMain.handle(IPC.chatClear, () => {
    if (active) active.abort()
    active = null
    memory.clear()
    emit({ type: 'reset' })
    log('info', 'chat', 'conversation memory cleared by user')
    return true
  })

  const ACTION_REPORT_PREFIX = '[SYSTEM ACTION REPORT]'

  function describeProposal(proposal: PendingProposal): string {
    const p = proposal.payload
    switch (proposal.kind) {
      case 'launch':
        return p.url ? `open ${p.url} in ${p.app}` : `launch ${p.app}`
      case 'volume':
        return `set system volume to ${p.level ?? '?'}%`
      case 'mute':
        return 'toggle system mute'
      case 'brightness':
        return `set screen brightness to ${p.level ?? '?'}%`
      case 'organize':
        return `organize the "${proposal.sourceName ?? p.app ?? 'folder'}" folder`
      case 'schedule':
        return `schedule a routine (${p.app ?? ''})`
      default:
        return proposal.kind
    }
  }

  const runActionFollowUp = (reportLines: string[]): void => {
    if (active) active.abort()
    const report = `${ACTION_REPORT_PREFIX} ${reportLines.join(' ')}`
    memory.append('user', report)
    const turns: ChatTurn[] = [
      { role: 'system', content: `${SYSTEM_PROMPT}\n\n${TOOL_PROTOCOL_INSTRUCTIONS}` },
      ...memory.recent().map((m) => ({ role: m.role, content: m.content }) as ChatTurn)
    ]
    const controller = new AbortController()
    active = controller
    void streamResponse(router, memory, registry, turns, controller, emit, '')
      .catch((err: unknown) => {
        log(
          'error',
          'chat',
          `action follow-up failed: ${err instanceof Error ? err.message : String(err)}`
        )
      })
      .finally(() => {
        if (active === controller) active = null
      })
  }

  ipcMain.handle(IPC.actionDecide, async (_event, raw: unknown) => {
    const id =
      typeof (raw as { id?: unknown })?.['id'] === 'string' ? (raw as { id: string }).id : ''
    const approved = Boolean((raw as { approved?: unknown })?.approved)
    const proposal = getProposal(id)
    if (!proposal) return 'That proposal already expired or was handled'

    resolveProposal(id)
    if (!approved) {
      log('info', 'action', `proposal ${id} cancelled by user`)
      runActionFollowUp([
        'The user reviewed the confirmation dialog and chose CANCEL.',
        `Proposed action was: ${describeProposal(proposal)}.`,
        'Nothing was changed. Acknowledge this in one short sentence and ask what they would like instead.'
      ])
      return 'Cancelled. Nothing was changed'
    }

    log('info', 'action', `proposal ${id} approved — kind=${proposal.kind}`)
    return executeApproved(proposal, (summary) => {
      emit({ type: 'tool', name: 'action_applied', argsSummary: summary })
    }).then((summary) => {
      runActionFollowUp([
        `The user APPROVED the action: ${describeProposal(proposal)}.`,
        `Execution finished with this exact result: ${summary}`,
        summary.startsWith('✓')
          ? 'Confirm the real outcome briefly. Do not invent anything that happened beyond the result line.'
          : 'The action FAILED. Tell the user honestly what went wrong using only the result line above. Never claim success.'
      ])
      return summary
    })
  })
}

async function executeApproved(
  proposal: PendingProposal,
  announce: (summary: string) => void
): Promise<string> {
  try {
    if (proposal.kind === 'organize') {
      const moves = proposal.payload.moves ?? []
      const result = executeOrganizationPlan(proposal.sourceDir ?? '', moves)
      const parts = [`✓ Moved ${result.moved} file${result.moved === 1 ? '' : 's'}`]
      if (result.failed.length > 0) {
        parts.push(
          `${result.failed.length} could not move: ${result.failed.map((f) => f.fileName).join(', ')}`
        )
      }
      const summary = `${parts.join('. ')} in "${proposal.sourceName}"`
      announce(summary)
      return summary
    }

    if (proposal.kind === 'volume') {
      const level = proposal.payload.level ?? 0
      await setVolume(level)
      const summary = `✓ Volume set to about ${level}%`
      announce(summary)
      return summary
    }

    if (proposal.kind === 'mute') {
      await toggleMute()
      const summary = '✓ Mute toggled'
      announce(summary)
      return summary
    }

    if (proposal.kind === 'brightness') {
      const level = proposal.payload.level ?? 0
      await setBrightness(level)
      const summary = `✓ Brightness set to ${level}%`
      announce(summary)
      return summary
    }

    if (proposal.kind === 'launch') {
      const app = proposal.payload.app ?? ''
      const result = await launchApp(app, proposal.payload.url)
      const summary = `✓ ${result}`
      announce(summary)
      return summary
    }

    if (proposal.kind === 'schedule') {
      const [folderName, timeHHMM, name] = (proposal.payload.app ?? '').split('|')
      if (!folderName || !timeHHMM) return '✗ Routine data was incomplete'
      addRoutine(name ?? `Nightly tidy of ${folderName}`, folderName, timeHHMM)
      const summary = `✓ Scheduled: ${name ?? folderName} runs daily at ${timeHHMM}`
      announce(summary)
      return summary
    }

    return 'Unknown proposal type — nothing was done'
  } catch (err) {
    const message = err instanceof Error ? err.message : 'The action failed'
    const summary = `✗ ${message}`
    announce(summary)
    return summary
  }
}

async function streamResponse(
  router: ProviderRouter,
  memory: ConversationMemory,
  registry: ToolRegistry,
  turns: ChatTurn[],
  controller: AbortController,
  emit: (event: StreamEvent) => void,
  userText: string
): Promise<void> {
  const attempted = new Set<string>()
  const failed = new Set<ProviderId>()
  let nudged = false
  let retriedSmall = false

  for (let hop = 0; ; hop++) {
    const provider = failed.size > 0 ? router.pick(Date.now(), [...failed]) : router.pick()
    const apiKey = getApiKey(provider.id)
    if (!apiKey) {
      emit({
        type: 'error',
        message: `No ${provider.id} API key configured. Add it to .env or Settings`,
        recoverable: false
      })
      return
    }

    attempted.add(provider.id)
    emit({ type: 'start', provider: provider.id, model: provider.model })

    let full = ''
    try {
      const timeout = AbortSignal.timeout(PROVIDER_TIMEOUT_MS)
      const signal = AbortSignal.any([controller.signal, timeout])
      for await (const chunk of provider.stream({ turns, apiKey, signal })) {
        full += chunk
        emit({ type: 'delta', text: chunk })
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError' || (err as Error).name === 'TimeoutError') {
        if (full.length > 0) {
          const notice =
            '\n\n_(my connection cut off mid-answer — say "continue" if it stops short)_'
          full += notice
          emit({ type: 'delta', text: notice })
          log('warn', 'chat', `${provider.id} timed out mid-stream; kept partial answer`)
          memory.append('assistant', `${full} ${CUTOFF_MARKER}`)
          return
        }
        emit({
          type: 'error',
          message: `${provider.id} took too long to answer. Please try sending that again`,
          recoverable: true
        })
        log('warn', 'chat', `${provider.id} timed out`)
        return
      }

      const isProviderError = err instanceof ProviderError
      const canFailOver = isProviderError && err.recoverable && attempted.size < router.count

      if (isProviderError && err.status === 413 && !retriedSmall) {
        log('warn', 'chat', `${provider.id} 413 payload too large — retrying with smaller context`)
        retriedSmall = true
        turns.length = 1
        turns.push(
          ...memory.recent(10).map((m) => ({ role: m.role, content: m.content }) as ChatTurn)
        )
        continue
      }

      if (canFailOver) {
        if (err.status === 429) router.markRateLimited(err.provider)
        failed.add(err.provider)
        log(
          'warn',
          'chat',
          `${err.provider} failed ${full.length > 0 ? `mid-stream (${full.length} chars) ` : ''}(${err.status ?? 'network'}), switching providers`
        )
        continue
      }
      throw err
    }

    if (controller.signal.aborted) return

    if (full.length === 0) {
      if (attempted.size < router.count) {
        log('warn', 'chat', `${provider.id} returned an empty stream, failing over`)
        continue
      }
      emit({
        type: 'error',
        message: 'The provider came back with an empty response. Please try again',
        recoverable: true
      })
      return
    }

    const action = extractToolAction(full)

    if (!action) {
      if (shouldNudge({ hadAction: false, alreadyNudged: nudged, userText, replyText: full })) {
        nudged = true
        memory.append('assistant', full)
        turns.push({ role: 'assistant', content: full })
        turns.push({ role: 'user', content: NUDGE_MESSAGE })
        log('info', 'chat', 'file question without tool action — nudging model to call a tool')
        continue
      }

      memory.append('assistant', full)
      emit({ type: 'done', provider: provider.id, model: provider.model })
      log('info', 'chat', `responded via ${provider.id} (${full.length} chars)`)
      return
    }

    if (hop >= MAX_TOOL_HOPS) {
      memory.append('assistant', BUDGET_LINE)
      emit({ type: 'delta', text: `\n\n${BUDGET_LINE}` })
      emit({ type: 'done', provider: provider.id, model: provider.model })
      log('warn', 'chat', `tool step budget (${MAX_TOOL_HOPS}) reached; stopped safely`)
      return
    }

    memory.append('assistant', full)
    emit({
      type: 'tool',
      name: action.tool,
      argsSummary: Object.values(action.args).join(', ')
    })
    log('info', 'tool', `${action.tool} ${JSON.stringify(action.args)}`)

    let toolOutcome: string
    try {
      toolOutcome = await registry.execute(action)
    } catch (err) {
      toolOutcome = `TOOL_ERROR: ${err instanceof Error ? err.message : String(err)}`
    }
    memory.append('user', `TOOL_RESULT for "${action.tool}":\n${toolOutcome}`)
    turns.push({ role: 'assistant', content: full })
    turns.push({
      role: 'user',
      content:
        hop + 1 > MAX_TOOL_HOPS
          ? `TOOL_RESULT for "${action.tool}" was received. Stop using tools and answer in prose now.`
          : `TOOL_RESULT for "${action.tool}":\n${toolOutcome}`
    })
  }
}
