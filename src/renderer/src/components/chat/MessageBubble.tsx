import { motion } from 'framer-motion'
import type { UiMessage } from '../../hooks/useChat'
import { PROVIDER_MODELS } from '@shared/providers'

const containerStyles: Record<string, string> = {
  user: 'justify-end',
  assistant: 'justify-start',
  system: 'justify-start',
  error: 'justify-center'
}

const bubbleStyles: Record<string, string> = {
  user: 'bg-panel-raised border-edge text-ink rounded-2xl rounded-br-sm',
  assistant: 'bg-panel border-edge text-ink rounded-2xl rounded-bl-sm',
  error: 'bg-warning/10 border-warning/40 text-warning rounded-xl'
}

export function MessageBubble({ message }: { message: UiMessage }) {
  const isUser = message.role === 'user'
  const isError = message.role === 'error'
  const providerLabel = message.provider ? PROVIDER_MODELS[message.provider].label : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={`flex w-full ${containerStyles[message.role] ?? containerStyles.assistant}`}
    >
      <div className={`max-w-[78%] ${isError ? 'w-auto' : ''}`}>
        {!isUser && !isError && (
          <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
            Ashir&apos;s AI{providerLabel ? ` · ${providerLabel}` : ''}
          </div>
        )}
        <div
          className={`border px-4 py-3 text-sm leading-relaxed ${bubbleStyles[message.role] ?? bubbleStyles.assistant}`}
        >
          <p className="whitespace-pre-wrap break-words">
            {message.content}
            {message.streaming && (
              <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-accent align-middle" />
            )}
          </p>
        </div>
      </div>
    </motion.div>
  )
}
