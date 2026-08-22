import { ipcMain, type WebContents } from 'electron'
import { IPC } from '@shared/ipc'
import type { SendChatRequest, StreamEvent } from '@shared/chat'
import { TOOL_PROTOCOL_INSTRUCTIONS } from '@shared/tools'
import { getApiKey } from '../settings/store'
import type { ConversationMemory } from '../conversation/memory'
import { SYSTEM_PROMPT } from '../conversation/persona'
import { ProviderError } from '../llm/errors'
import type { ChatTurn } from '../llm/provider'
import type { ProviderRouter } from '../llm/router'
import type { ToolRegistry } from '../tools/registry'
import { extractToolAction } from '../tools/parse'
import { getProposal, resolveProposal } from '../tools/proposals'
import { executeOrganizationPlan } from '../fs/executor'
import { NUDGE_MESSAGE, shouldNudge } from '../tools/nudge'
import { log } from '../lib/logger'

const MAX_INPUT_LENGTH = 8000
const PROVIDER_TIMEOUT_MS = 45_000
const MAX_TOOL_HOPS = 3

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

  ipcMain.handle(IPC.actionDecide, (_event, raw: unknown) => {
    const id =
      typeof (raw as { id?: unknown })?.['id'] === 'string' ? (raw as { id: string }).id : ''
    const approved = Boolean((raw as { approved?: unknown })?.approved)
    const proposal = getProposal(id)
    if (!proposal) return 'That proposal already expired or was handled'

    resolveProposal(id)
    if (!approved) {
      log('info', 'action', `proposal ${id} cancelled by user`)
      return 'Cancelled. Nothing was moved'
    }

    log('info', 'action', `proposal ${id} approved — executing ${proposal.moves.length} moves`)
    const result = executeOrganizationPlan(proposal.sourceDir, proposal.moves)

    const parts = [`✓ Moved ${result.moved} file${result.moved === 1 ? '' : 's'}`]
    if (result.failed.length > 0) {
      parts.push(
        `${result.failed.length} could not move: ${result.failed.map((f) => f.fileName).join(', ')}`
      )
    }
    const summary = `${parts.join('. ')} in "${proposal.sourceName}"`

    memory.append('assistant', summary)
    emit({ type: 'tool', name: 'organize_applied', argsSummary: summary })
    return summary
  })
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
  let nudged = false

  for (let hop = 0; ; hop++) {
    const provider = router.pick()
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
          break
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

      if (canFailOver) {
        if (err.status === 429) router.markRateLimited(err.provider)
        log(
          'warn',
          'chat',
          `${err.provider} failed ${full.length > 0 ? `mid-stream (${full.length} chars) ` : ''}(${err.status ?? 'network'}), failing over`
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
    if (!action || hop >= MAX_TOOL_HOPS) {
      if (
        !action &&
        shouldNudge({ hadAction: false, alreadyNudged: nudged, userText, replyText: full })
      ) {
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
