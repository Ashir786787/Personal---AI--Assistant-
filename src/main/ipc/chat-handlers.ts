import { ipcMain, type WebContents } from 'electron'
import { IPC } from '@shared/ipc'
import type { SendChatRequest, StreamEvent } from '@shared/chat'
import { getApiKey } from '../settings/store'
import type { ConversationMemory } from '../conversation/memory'
import { SYSTEM_PROMPT } from '../conversation/persona'
import { ProviderError } from '../llm/errors'
import type { ChatTurn } from '../llm/provider'
import type { ProviderRouter } from '../llm/router'
import { log } from '../lib/logger'

const MAX_INPUT_LENGTH = 8000
const PROVIDER_TIMEOUT_MS = 45_000

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
  memory: ConversationMemory
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
      { role: 'system', content: SYSTEM_PROMPT },
      ...memory.recent().map((m) => ({ role: m.role, content: m.content }) as ChatTurn)
    ]

    void streamResponse(router, memory, turns, controller, emit)
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
}

async function streamResponse(
  router: ProviderRouter,
  memory: ConversationMemory,
  turns: ChatTurn[],
  controller: AbortController,
  emit: (event: StreamEvent) => void
): Promise<void> {
  const attempted = new Set<string>()

  while (true) {
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
      if (full.length > 0) memory.append('assistant', full)
      emit({ type: 'done', provider: provider.id, model: provider.model })
      log('info', 'chat', `responded via ${provider.id} (${full.length} chars)`)
      return
    } catch (err) {
      if ((err as Error).name === 'AbortError' || (err as Error).name === 'TimeoutError') {
        if (full.length > 0) {
          memory.append('assistant', full)
          emit({ type: 'done', provider: provider.id, model: provider.model })
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
      const canFailOver =
        isProviderError && err.recoverable && full.length === 0 && attempted.size < router.count

      if (canFailOver) {
        if (err.status === 429) router.markRateLimited(err.provider)
        log('warn', 'chat', `${err.provider} failed (${err.status ?? 'network'}), failing over`)
        continue
      }
      throw err
    }
  }
}
