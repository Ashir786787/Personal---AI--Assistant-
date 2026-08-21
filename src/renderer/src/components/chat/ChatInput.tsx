import { useRef } from 'react'
import { MicButton } from '../voice/MicButton'

interface ChatInputProps {
  value: string
  onValueChange: (value: string) => void
  busy: boolean
  ttsEnabled: boolean
  micListening: boolean
  micLevel: number
  voiceNotice: string | null
  onSend: (text: string) => void
  onToggleMic: () => void
  onToggleTts: () => void
}

export function ChatInput({
  value,
  onValueChange,
  busy,
  ttsEnabled,
  micListening,
  micLevel,
  voiceNotice,
  onSend,
  onToggleMic,
  onToggleTts
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const submit = (): void => {
    if (value.trim().length === 0 || busy) return
    onSend(value)
    onValueChange('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const resize = (next: string): void => {
    onValueChange(next)
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  return (
    <div className="border-t border-edge bg-panel px-4 py-3">
      {voiceNotice && <p className="mb-2 font-mono text-[11px] text-warning">{voiceNotice}</p>}
      <div className="flex items-end gap-2">
        <MicButton
          level={micLevel}
          listening={micListening}
          disabled={busy}
          onToggle={onToggleMic}
        />
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          placeholder="Message ASHIR's AI…"
          onChange={(e) => resize(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          className="max-h-40 flex-1 resize-none rounded-xl border border-edge bg-base px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted/60 focus:border-accent-dim focus:outline-none"
        />
        <button
          type="button"
          onClick={onToggleTts}
          aria-label={ttsEnabled ? 'Mute voice output' : 'Unmute voice output'}
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
        <button
          type="button"
          onClick={submit}
          disabled={busy || value.trim().length === 0}
          aria-label="Send message"
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
          >
            <path d="m5 12 14-7-4 7 4 7-14-7Z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
