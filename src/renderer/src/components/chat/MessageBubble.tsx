import { motion } from 'framer-motion'
import type { UiMessage } from '../../hooks/useChat'
import { PROVIDER_MODELS } from '@shared/providers'
import { formatElapsedMs } from '../../lib/format'
import { Markdown } from './Markdown'
import { ToolCard } from './ToolCard'

const containerStyles: Record<string, string> = {
  user: 'justify-end',
  assistant: 'justify-start',
  system: 'justify-start',
  tool: 'justify-start',
  error: 'justify-center'
}

const bubbleStyles: Record<string, string> = {
  user: 'bg-panel-raised border-edge text-ink rounded-2xl rounded-br-sm',
  assistant: 'bg-panel border-edge text-ink rounded-2xl rounded-bl-sm',
  tool: 'bg-transparent border-accent-dim/40 text-accent-dim rounded-lg',
  error: 'bg-warning/10 border-warning/40 text-warning rounded-xl'
}

export function MessageBubble({ message }: { message: UiMessage }) {
  const isUser = message.role === 'user'
  const isError = message.role === 'error'
  const providerLabel = message.provider ? PROVIDER_MODELS[message.provider].label : null
  const caption = providerLabel
    ? `via ${providerLabel}${message.elapsedMs !== undefined ? ` · ${formatElapsedMs(message.elapsedMs)}` : ''}`
    : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={`flex w-full ${containerStyles[message.role] ?? containerStyles.assistant}`}
    >
      {message.role === 'tool' ? (
        <ToolCard
          name={message.content}
          status={message.toolStatus}
          detail={message.detail}
          statusDetail={message.statusDetail}
          kind={message.kind}
        />
      ) : (
        <div className={`max-w-[78%] ${isError ? 'w-auto' : ''}`}>
          <div
            className={`border px-4 py-3 text-sm leading-relaxed ${bubbleStyles[message.role] ?? bubbleStyles.assistant}`}
          >
            {isUser || isError ? (
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            ) : (
              <>
                <Markdown text={message.content} />
                {message.streaming && (
                  <span
                    aria-hidden="true"
                    className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-accent align-middle"
                  />
                )}
              </>
            )}
          </div>
          {caption && (
            <p className="mt-1 font-mono text-[11px] tracking-wide text-ink-muted">{caption}</p>
          )}
        </div>
      )}
    </motion.div>
  )
}
