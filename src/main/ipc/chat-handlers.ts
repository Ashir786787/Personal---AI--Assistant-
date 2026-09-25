import { ipcMain, type WebContents } from 'electron'
import { IPC, type StatusSnapshot } from '@shared/ipc'
import type { SendChatRequest, StreamEvent } from '@shared/chat'
import type { ProviderId } from '@shared/providers'
import { TOOL_PROTOCOL_INSTRUCTIONS } from '@shared/tools'
import { isAgentId, agentConfig, type AgentId } from '@shared/agents'
import { getApiKey } from '../settings/store'
import { ConversationMemory } from '../conversation/memory'
import { SYSTEM_PROMPT } from '../conversation/persona'
import { ProviderError } from '../llm/errors'
import type { ChatTurn } from '../llm/provider'
import type { ProviderRouter } from '../llm/router'
import type { ToolRegistry } from '../tools/registry'
import { scopedToolUsage } from './tool-scope'
import { extractToolAction } from '../tools/parse'
import { getProposal, resolveProposal, type PendingProposal } from '../tools/proposals'
import { executeOrganizationPlan } from '../fs/executor'
import { isExcludedAppPath, isProtectedWritePath } from '../fs/scope'
import { setVolume, toggleMute } from '../system/volume'
import { setBrightness } from '../system/brightness'
import { launchApp } from '../system/apps'
import { addRoutine } from '../routines/store'
import { NUDGE_MESSAGE, shouldNudge } from '../tools/nudge'
import { maybeDelegateComplex } from '../tools/orchestrator'
import { log } from '../lib/logger'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { basename, dirname } from 'path'

const MAX_INPUT_LENGTH = 8000
const PROVIDER_TIMEOUT_MS = 45_000
const MAX_TOOL_HOPS = 6
const MAX_TURN_CHARS = 2000

const CUTOFF_MARKER = '[my previous answer was cut off mid-sentence]'
const BUDGET_LINE =
  'I\'ve used my step budget for this request and stopped safely. Say "continue" and I\'ll pick up where I left off'

export class ValidationError extends Error {}

function truncate(text: string, max = MAX_TURN_CHARS): string {
  return text.length > max ? text.slice(0, max) + '…(truncated)' : text
}

function parseRequest(raw: unknown): SendChatRequest {
  if (typeof raw !== 'object' || raw === null || !('text' in raw)) {
    throw new ValidationError('Malformed request')
  }
  const text = String((raw as SendChatRequest).text).trim()
  if (text.length === 0) throw new ValidationError('Message is empty')
  if (text.length > MAX_INPUT_LENGTH) {
    throw new ValidationError(`Message too long (${text.length} chars, max ${MAX_INPUT_LENGTH})`)
  }
  const agentId = (raw as SendChatRequest).agentId
  if (agentId !== undefined && !isAgentId(agentId)) {
    throw new ValidationError('Unknown agent id')
  }
  return { text, ...(agentId !== undefined ? { agentId } : {}) }
}

/** Fully scoped conversation context for one chat-or-agent turn. */
interface ChatRuntime {
  memory: ConversationMemory
  systemPrompt: string
  instructions: string
  allowedTools: ReadonlySet<string> | null
}

function runtimeFor(
  agentId: AgentId | undefined,
  mainMemory: ConversationMemory,
  agentMemories: ReadonlyMap<AgentId, ConversationMemory>,
  registry: ToolRegistry
): ChatRuntime {
  if (agentId === undefined) {
    return {
      memory: mainMemory,
      systemPrompt: SYSTEM_PROMPT,
      instructions: TOOL_PROTOCOL_INSTRUCTIONS,
      allowedTools: null
    }
  }
  const config = agentConfig(agentId)
  const allowedTools = new Set(config.tools)
  return {
    memory: agentMemories.get(agentId) ?? new ConversationMemory(),
    systemPrompt: config.systemPrompt,
    instructions: scopedToolUsage(registry.definitionsFor(allowedTools)),
    allowedTools
  }
}

export function registerChatIpc(
  webContents: WebContents,
  router: ProviderRouter,
  memory: ConversationMemory,
  registry: ToolRegistry,
  agentMemories: ReadonlyMap<AgentId, ConversationMemory>
): void {
  let active: AbortController | null = null

  const emit = (event: StreamEvent): void => {
    if (!webContents.isDestroyed()) webContents.send(IPC.chatStream, event)
  }

  ipcMain.handle(IPC.statusSnapshot, (): StatusSnapshot => ({
    providers: router.health(),
    agents: { working: 0, total: 4 }
  }))

  ipcMain.handle(IPC.chatSend, async (_event, raw: unknown) => {
    const request = parseRequest(raw)

    if (active) active.abort()
    const controller = new AbortController()
    active = controller

    const runtime = runtimeFor(request.agentId, memory, agentMemories, registry)

    const userMessage = runtime.memory.append('user', request.text)

    // Hard multi-part requests get delegated to the town agents first. Their
    // reports land in memory so the supervisor answers with real evidence.
    let delegated = false
    if (request.agentId === undefined) {
      const result = await maybeDelegateComplex({
        router,
        registry,
        agentMemories,
        controller,
        userText: request.text,
        getApiKey: (provider) => getApiKey(provider),
        emit
      })
      delegated = result.handled
      if (delegated) {
        for (const report of result.reports) {
          runtime.memory.append('user', `[AGENT REPORT (${report.name})]\n${report.text}`)
        }
        if (result.reports.length === 0 || controller.signal.aborted) {
          emit({ type: 'cancelled' })
          return { userMessageId: userMessage.id }
        }
      }
    }

    const turns: ChatTurn[] = [
      { role: 'system', content: `${runtime.systemPrompt}\n\n${runtime.instructions}` },
      ...runtime.memory
        .recent()
        .map((m) => ({ role: m.role, content: truncate(m.content) }) as ChatTurn)
    ]

    void streamResponse(
      router,
      runtime.memory,
      registry,
      turns,
      controller,
      emit,
      request.text,
      runtime.allowedTools
    )
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
      case 'write':
        return `write "${proposal.sourceName ?? p.path ?? '?'}"`
      case 'delete':
        return `delete "${p.path ?? '?'}"`
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
      ...memory.recent().map((m) => ({ role: m.role, content: truncate(m.content) }) as ChatTurn)
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

    if (proposal.kind === 'write') {
      const target = proposal.payload.path ?? ''
      const content = proposal.payload.content ?? ''
      if (!target || content.length === 0) return '✗ Write request was incomplete'
      if (isExcludedAppPath(target) || isProtectedWritePath(target)) {
        return '✗ Refused: that path is protected (Discord, WhatsApp, VS Code or a system folder)'
      }
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, content, 'utf8')
      const summary = `✓ Wrote ${basename(target)}`
      announce(summary)
      return summary
    }

    if (proposal.kind === 'delete') {
      const target = proposal.payload.path ?? ''
      if (!target) return '✗ Delete request was incomplete'
      if (isExcludedAppPath(target) || isProtectedWritePath(target)) {
        return '✗ Refused: that path is protected (Discord, WhatsApp, VS Code or a system folder)'
      }
      await rm(target, { recursive: true, force: false })
      const summary = `✓ Deleted ${basename(target)}`
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
  userText: string,
  allowed?: ReadonlySet<string> | null
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
      if ((err as Error).name === 'AbortError') {
        if (full.length > 0) {
          const notice = '\n\n_(stopped — the turn was cancelled mid-answer)_'
          full += notice
          emit({ type: 'delta', text: notice })
          emit({ type: 'cancelled' })
          log('warn', 'chat', `${provider.id} turn cancelled with a partial answer`)
          memory.append('assistant', `${full} ${CUTOFF_MARKER}`)
          return
        }
        emit({ type: 'cancelled' })
        log('warn', 'chat', `${provider.id} turn cancelled before any output`)
        return
      }

      if ((err as Error).name === 'TimeoutError') {
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
          ...memory
            .recent(6)
            .map((m) => ({ role: m.role, content: truncate(m.content) }) as ChatTurn)
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

    if (controller.signal.aborted) {
      emit({ type: 'cancelled' })
      return
    }

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
      toolOutcome = await registry.execute(action, allowed)
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
