import type { ProviderId } from '@shared/providers'
import { THEME_ACCENT, type ThemeId } from '../../theme'
import type { WakeStatus } from '../../hooks/useWakeWord'

interface StatusBarProps {
  micState: 'idle' | 'listening' | 'denied'
  lastProvider: ProviderId | null
  busy: boolean
  theme: ThemeId
  updateLabel: string | null
  wakeStatus: WakeStatus | null
  onCycleTheme: () => void
  onOpenSettings: () => void
  onUpdateOpen: () => void
}

export function StatusBar({
  micState,
  lastProvider,
  busy,
  theme,
  updateLabel: label,
  wakeStatus,
  onCycleTheme,
  onOpenSettings,
  onUpdateOpen
}: StatusBarProps) {
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
        {wakeStatus && wakeStatus !== 'off' && (
          <span
            className="flex items-center gap-1.5"
            title={
              wakeStatus === 'armed'
                ? 'Wake word armed — say "Jarvis" or "Hey Dude"'
                : wakeStatus === 'error'
                  ? 'Wake word needs setup in Settings'
                  : wakeStatus === 'downloading'
                    ? 'Downloading wake-word model'
                    : 'Wake word standing by'
            }
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                wakeStatus === 'armed'
                  ? 'bg-accent animate-pulse'
                  : wakeStatus === 'error' || wakeStatus === 'downloading'
                    ? 'bg-warning'
                    : 'bg-ink-muted'
              }`}
            />
            Wake
          </span>
        )}
        {label && (
          <button
            className="update-pill"
            title="Update ready — click to open"
            onClick={onUpdateOpen}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
            {label}
          </button>
        )}
        <button
          className="theme-pill"
          title={`Theme: ${theme} — click to switch`}
          aria-label="Switch theme"
          onClick={onCycleTheme}
        >
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: THEME_ACCENT[theme] }} />
        </button>
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
