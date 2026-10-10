import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { StreamEvent } from '@shared/chat'
import {
  canRegenerate as canRegenerateState,
  chatReducer,
  initialChatState,
  type ChatAction,
  type ChatState,
  type UiMessage
} from '../lib/chat-reducer'

export type { UiMessage } from '../lib/chat-reducer'

const BRIDGE_MISSING =
  "The secure bridge to the assistant core is not available. If you are viewing this in a regular browser tab, close it and use the ASHIR's AI desktop window instead."
const SEND_FAILED = 'The message never reached the assistant. Try sending it again.'

let idCounter = 0
function nextId(prefix: string): string {
  idCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`
}

function reduceStreamEvent(state: ChatState, event: StreamEvent, now: number): ChatState {
  switch (event.type) {
    case 'turnStart':
      return chatReducer(state, { type: 'turn-start', turnId: event.turnId, now: event.startedAt })
    case 'start':
      return chatReducer(state, {
        type: 'provider-start',
        id: nextId('assistant'),
        provider: event.provider,
        now
      })
    case 'delta':
      return chatReducer(state, { type: 'delta', text: event.text })
    case 'tool':
      return chatReducer(state, {
        type: 'tool-start',
        id: nextId('tool'),
        toolId: event.toolId,
        name: event.name,
        detail: event.argsSummary
      })
    case 'toolStatus':
      return chatReducer(state, {
        type: 'tool-status',
        toolId: event.toolId,
        status: event.status,
        ...(event.detail !== undefined ? { detail: event.detail } : {})
      })
    case 'toolDone':
      return chatReducer(state, { type: 'tool-status', toolId: event.toolId, status: 'done' })
    case 'toolFailed':
      return chatReducer(state, {
        type: 'tool-status',
        toolId: event.toolId,
        status: 'failed',
        detail: event.message
      })
    case 'agent':
      return event.state === 'start'
        ? chatReducer(state, {
            type: 'agent-start',
            id: nextId('agent'),
            agentId: event.agentId,
            name: event.name
          })
        : chatReducer(state, {
            type: 'agent-end',
            agentId: event.agentId,
            status: event.state === 'failed' ? 'failed' : 'done'
          })
    case 'done':
    case 'cancelled':
      return chatReducer(state, { type: 'settle', now })
    case 'error':
      return chatReducer(state, { type: 'error', id: nextId('error'), message: event.message, now })
    case 'reset':
      return chatReducer(state, { type: 'reset' })
  }
}

export interface UseChat {
  messages: UiMessage[]
  busy: boolean
  canRegenerate: boolean
  send: (text: string) => void
  stop: () => void
  regenerate: () => void
}

export function useChat(): UseChat {
  const [state, setState] = useState<ChatState>(initialChatState)
  const stateRef = useRef<ChatState>(initialChatState)

  // Stream events arrive faster than React renders, so the latest state is tracked
  // in a ref and every event is reduced synchronously.
  const dispatch = useCallback((action: ChatAction): void => {
    const next = chatReducer(stateRef.current, action)
    stateRef.current = next
    setState(next)
  }, [])

  useEffect(() => {
    if (typeof window.ashirs === 'undefined') {
      dispatch({ type: 'notice', id: 'error-bridge', message: BRIDGE_MISSING })
      return
    }

    const unsubscribe = window.ashirs.onStreamEvent((event) => {
      stateRef.current = reduceStreamEvent(stateRef.current, event, Date.now())
      setState(stateRef.current)
    })
    return unsubscribe
  }, [dispatch])

  const send = useCallback(
    (text: string): void => {
      const trimmed = text.trim()
      if (trimmed.length === 0 || stateRef.current.busy) return

      if (typeof window.ashirs === 'undefined') {
        dispatch({ type: 'notice', id: nextId('error'), message: BRIDGE_MISSING })
        return
      }

      const localId = nextId('user')
      const turnId = nextId('turn')
      dispatch({ type: 'user-sent', id: localId, text: trimmed, turnId, now: Date.now() })

      window.ashirs.sendChat({ text: trimmed }).catch(() => {
        dispatch({
          type: 'send-failed',
          userId: localId,
          id: nextId('error'),
          message: SEND_FAILED,
          now: Date.now()
        })
      })
    },
    [dispatch]
  )

  const stop = useCallback((): void => {
    if (typeof window.ashirs === 'undefined') return
    window.ashirs.cancelChat()
  }, [])

  const regenerate = useCallback((): void => {
    if (stateRef.current.busy || typeof window.ashirs === 'undefined') return
    void window.ashirs.regenerateChat().then((result) => {
      if (!result) return
      dispatch({ type: 'regenerate', turnId: nextId('turn'), now: Date.now() })
    })
  }, [dispatch])

  const canRegenerate = useMemo(() => canRegenerateState(state), [state])

  return { messages: state.messages, busy: state.busy, canRegenerate, send, stop, regenerate }
}
