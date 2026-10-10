import { useRef } from 'react'
import { MAX_CHAT_INPUT_LENGTH } from '@shared/chat'
import { MicButton } from '../voice/MicButton'

const NEAR_CAP_RATIO = 0.9
const MAX_TEXTAREA_HEIGHT = 144

interface ChatInputProps {
  value: string
  onValueChange: (value: string) => void
  busy: boolean
  powered: boolean
  ttsEnabled: boolean
  micListening: boolean
  micLevel: number
  voiceNotice: string | null
  canRegenerate: boolean
  onSend: (text: string) => void
  onStop: () => void
  onRegenerate: () => void
  onToggleMic: () => void
  onToggleTts: () => void
}

export function ChatInput({
  value,
  onValueChange,
  busy,
  powered,
  ttsEnabled,
  micListening,
  micLevel,
  voiceNotice,
  canRegenerate,
  onSend,
  onStop,
  onRegenerate,
  onToggleMic,
  onToggleTts
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const overCap = value.length >= MAX_CHAT_INPUT_LENGTH
  const nearCap = value.length >= MAX_CHAT_INPUT_LENGTH * NEAR_CAP_RATIO

  const submit = (): void => {
    if (value.trim().length === 0 || busy || overCap) return
    onSend(value)
    onValueChange('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const resize = (next: string): void => {
    onValueChange(next.slice(0, MAX_CHAT_INPUT_LENGTH))
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`
  }

  return (
    <div className="border-t border-edge bg-panel px-4 py-3">
      {voiceNotice && <p className="mb-2 font-mono text-[11px] text-warning">{voiceNotice}</p>}
      {!powered && (
        <p className="mb-2 font-mono text-[11px] text-ink-muted">
          AI is off â€” press Start AI on the Core view to begin.
        </p>
      )}
      <div className="flex items-end gap-2">
        <MicButton
          level={micLevel}
          listening={micListening}
          disabled={busy || !powered}
          onToggle={onToggleMic}
        />
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={!powered}
          maxLength={MAX_CHAT_INPUT_LENGTH}
          aria-label="Message"
          placeholder={powered ? "Message ASHIR's AIâ€¦" : 'Start AI to beginâ€¦'}
          onChange={(e) => resize(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          className="max-h-36 flex-1 resize-none rounded-xl border border-edge bg-base px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted/60 focus:border-accent-dim focus:outline-none disabled:opacity-60"
        />
        <button
          type="button"
          onClick={onToggleTts}
          aria-label={ttsEnabled ? 'Mute voice output' : 'Unmute voice output'}
          title={ttsEnabled ? 'Mute voice output' : 'Unmute voice output'}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors duration-fast hover:bg-panel-raised ${
            ttsEnabled ? 'text-accent' : 'text-ink-muted'
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M11 5 6 9H3v6h3l5 4V5Z" />
            {ttsEnabled ? (
              <>
                <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                <path d="M18.5 5.5a9.5 9.5 0 0 1 0 13" />
              </>
            ) : (
              <path d="m16 9 6 6m0-6-6 6" />
            )}
          </svg>
        </button>
        {busy ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop generating"
            title="Stop generating"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-edge bg-panel-raised text-ink transition-colors duration-fast hover:border-accent-dim hover:text-accent"
          >
            <span aria-hidden="true" className="h-3.5 w-3.5 rounded-[2px] bg-current" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={submit}
          disabled={busy || !powered || value.trim().length === 0 || overCap}
          aria-label="Send message"
          title="Send message"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-base transition-opacity duration-fast hover:opacity-90 disabled:opacity-30"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m5 12 14-7-4 7 4 7-14-7Z" />
          </svg>
        </button>
      </div>
      <div className="mt-1 flex items-center justify-end gap-3">
        {canRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            disabled={busy || !powered}
            title="Regenerate the last answer"
            className="font-mono text-[11px] text-ink-muted transition-colors duration-fast hover:text-accent disabled:opacity-40"
          >
            Regenerate
          </button>
        )}
        <span
          aria-live="polite"
          className={`font-mono text-[11px] ${
            overCap ? 'text-danger' : nearCap ? 'text-warning' : 'text-ink-muted/70'
          }`}
        >
          {value.length} / {MAX_CHAT_INPUT_LENGTH}
        </span>
      </div>
    </div>
  )
}
