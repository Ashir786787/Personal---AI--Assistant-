import type { ProviderId } from '@shared/providers'

interface StatusBarProps {
  micState: 'idle' | 'listening' | 'denied'
  lastProvider: ProviderId | null
  busy: boolean
  onOpenSettings: () => void
}

export function StatusBar({ micState, lastProvider, busy, onOpenSettings }: StatusBarProps) {
  const micLabel = micState === 'listening' ? 'LIVE' : micState === 'denied' ? 'DENIED' : 'READY'
  const micColor =
    micState === 'listening'
      ? 'bg-accent animate-pulse'
      : micState === 'denied'
        ? 'bg-warning'
        : 'bg-ink-muted'
  const linkLabel = busy && lastProvider ? `THINKING · ${lastProvider.toUpperCase()}` : 'LINK READY'

  return (
    <header className="flex h-10 shrink-0 items-center justify-between border-b border-edge bg-panel px-4">
      <div className="flex items-center gap-2.5">
        <span
          className={`h-1.5 w-1.5 rounded-full ${busy ? 'bg-accent animate-pulse' : 'bg-accent-dim'}`}
        />
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.25em] text-ink">
          Ashir&apos;s AI
        </span>
      </div>
      <div className="flex items-center gap-5 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${micColor}`} />
          Mic {micLabel}
        </span>
        <span>Agents 0</span>
        <span className={busy ? 'text-accent' : ''}>{linkLabel}</span>
        <button
          className="gear-btn"
          title="Settings"
          aria-label="Settings"
          onClick={onOpenSettings}
        >
          ⚙
        </button>
      </div>
    </header>
  )
}
