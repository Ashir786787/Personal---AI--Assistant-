import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { UiMessage } from '../../hooks/useChat'
import { MessageBubble } from './MessageBubble'

const STICKY_SLACK_PX = 48

/** Spec 4.3: title, one honest privacy line, five chips that fill the input only. */
const SUGGESTIONS = [
  'What can you actually do on this machine?',
  'Tidy my Downloads folder',
  'What did I work on last week?',
  'Set volume to 40%',
  'Remind me to schedule a nightly tidy'
]

interface MessageListProps {
  messages: UiMessage[]
  onSuggestion: (text: string) => void
}

export function MessageList({ messages, onSuggestion }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef(true)
  const [showPill, setShowPill] = useState(false)
  const reduceMotion = useReducedMotion()

  const onScroll = useCallback((): void => {
    const el = scrollRef.current
    if (!el) return
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    const atBottom = distanceToBottom <= STICKY_SLACK_PX
    stickRef.current = atBottom
    setShowPill(!atBottom && el.scrollHeight > el.clientHeight + STICKY_SLACK_PX)
  }, [])

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || !stickRef.current) return
    el.scrollTop = el.scrollHeight
  }, [messages])

  useEffect(() => {
    const el = scrollRef.current
    if (!el || !stickRef.current || reduceMotion) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, reduceMotion])

  const scrollToLatest = useCallback((): void => {
    const el = scrollRef.current
    if (!el) return
    stickRef.current = true
    setShowPill(false)
    el.scrollTo({ top: el.scrollHeight, behavior: reduceMotion ? 'auto' : 'smooth' })
  }, [reduceMotion])

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto px-4 py-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-10 text-center">
              <h2 className="text-sm font-semibold tracking-wide text-ink">
                ASHIR&apos;S AI is ready
              </h2>
              <p className="max-w-sm text-[13px] leading-relaxed text-ink-muted">
                Your messages are sent to the AI provider you chose in Settings. Your keys, memory
                and settings never leave this machine and stay encrypted here.
              </p>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => onSuggestion(suggestion)}
                    className="rounded-full border border-edge bg-panel-raised px-3 py-1.5 text-[12px] text-ink-muted transition-colors duration-fast hover:border-accent-dim hover:text-ink"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
      <AnimatePresence>
        {showPill && (
          <motion.button
            type="button"
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            onClick={scrollToLatest}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-edge bg-panel-raised px-3 py-1 font-mono text-[11px] text-ink-muted shadow-lg transition-colors duration-fast hover:text-ink"
          >
            Scroll to latest
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
