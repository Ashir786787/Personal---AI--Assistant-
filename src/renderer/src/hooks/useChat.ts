import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatRole } from '@shared/chat'
import type { ProviderId } from '@shared/providers'

export interface UiMessage {
  id: string
  role: ChatRole | 'error'
  content: string
  provider?: ProviderId
  streaming?: boolean
}

interface StreamState {
  messageId: string | null
  provider: ProviderId | null
}

function argsSummaryLabel(name: string, summary: string): string {
  return summary.length > 0 ? `${name} · ${summary}` : name
}

export function useChat() {
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [busy, setBusy] = useState(false)
  const stream = useRef<StreamState>({ messageId: null, provider: null })

  useEffect(() => {
    if (typeof window.ashirs === 'undefined') {
      setMessages([
        {
          id: 'error-bridge',
          role: 'error',
          content:
            "The secure bridge to the assistant core is not available. If you are viewing this in a regular browser tab, close it and use the ASHIR's AI desktop window instead."
        }
      ])
      return
    }

    const unsubscribe = window.ashirs.onStreamEvent((event) => {
      switch (event.type) {
        case 'start': {
          const id = `assistant-${Date.now()}`
          stream.current = { messageId: id, provider: event.provider }
          setMessages((prev) => [
            ...prev,
            { id, role: 'assistant', content: '', provider: event.provider, streaming: true }
          ])
          break
        }
        case 'delta': {
          const { messageId } = stream.current
          if (!messageId) break
          setMessages((prev) =>
            prev.map((m) => (m.id === messageId ? { ...m, content: m.content + event.text } : m))
          )
          break
        }
        case 'tool': {
          const failedId = stream.current.messageId
          setMessages((prev) => {
            const withoutRawJson = failedId !== null ? prev.filter((m) => m.id !== failedId) : prev
            return [
              ...withoutRawJson,
              {
                id: `tool-${Date.now()}`,
                role: 'tool',
                content: argsSummaryLabel(event.name, event.argsSummary)
              }
            ]
          })
          stream.current = { messageId: null, provider: null }
          break
        }
        case 'done': {
          const { messageId } = stream.current
          if (messageId) {
            setMessages((prev) =>
              prev.map((m) => (m.id === messageId ? { ...m, streaming: false } : m))
            )
          }
          stream.current = { messageId: null, provider: null }
          setBusy(false)
          break
        }
        case 'reset': {
          stream.current = { messageId: null, provider: null }
          setMessages([])
          setBusy(false)
          break
        }
        case 'error': {
          if (stream.current.messageId) {
            const failedId = stream.current.messageId
            setMessages((prev) =>
              prev
                .filter((m) => m.id !== failedId)
                .concat({ id: `error-${Date.now()}`, role: 'error', content: event.message })
            )
          } else {
            setMessages((prev) => [
              ...prev,
              { id: `error-${Date.now()}`, role: 'error', content: event.message }
            ])
          }
          stream.current = { messageId: null, provider: null }
          setBusy(false)
          break
        }
      }
    })
    return unsubscribe
  }, [])

  const send = useCallback(
    (text: string): void => {
      const trimmed = text.trim()
      if (trimmed.length === 0 || busy) return

      if (typeof window.ashirs === 'undefined') {
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'error',
            content:
              "The secure bridge is not available here. Close this browser tab and use the ASHIR's AI desktop window."
          }
        ])
        return
      }

      const localId = `user-${Date.now()}`
      setMessages((prev) => [...prev, { id: localId, role: 'user', content: trimmed }])
      setBusy(true)

      window.ashirs.sendChat({ text: trimmed }).catch(() => {
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== localId),
          {
            id: `error-${Date.now()}`,
            role: 'error',
            content: 'The message never reached the assistant. Try sending it again.'
          }
        ])
        setBusy(false)
      })
    },
    [busy]
  )

  return { messages, busy, send }
}
