interface MicButtonProps {
  level: number
  listening: boolean
  disabled: boolean
  onToggle: () => void
}

export function MicButton({ level, listening, disabled, onToggle }: MicButtonProps) {
  const reactiveScale = 1 + level * 0.35
  const reactiveOpacity = listening ? 0.25 + level * 0.75 : 0

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={listening ? 'Stop listening' : 'Start voice input'}
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors duration-fast hover:bg-panel-raised disabled:opacity-40"
    >
      <svg viewBox="0 0 44 44" className="absolute inset-0 h-full w-full -rotate-90">
        <circle
          cx="22"
          cy="22"
          r="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          className="text-edge"
        />
        <circle
          cx="22"
          cy="22"
          r="20"
          fill="none"
          strokeWidth="1.5"
          className="text-accent transition-opacity duration-normal"
          style={{
            opacity: reactiveOpacity,
            transformOrigin: 'center',
            transform: `scale(${reactiveScale})`
          }}
        />
      </svg>
      <svg
        viewBox="0 0 24 24"
        className={`h-5 w-5 ${listening ? 'text-accent' : 'text-ink-muted'}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      >
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0" />
        <path d="M12 18v3" />
      </svg>
    </button>
  )
}
