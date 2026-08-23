import { useEffect, useRef } from 'react'
import type { UiMessage } from '../../hooks/useChat'
import { MessageBubble } from './MessageBubble'

export function MessageList({ messages }: { messages: UiMessage[] }) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent-dim">
          System online
        </div>
        <h1 className="text-2xl font-medium text-ink">Say hello, Ashir.</h1>
        <p className="max-w-xs text-sm text-ink-muted">
          Type a message below or tap the mic to speak. Your conversations never leave this machine.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-6">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
