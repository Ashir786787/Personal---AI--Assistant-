import { useEffect, useState } from 'react'
import type { ProviderId } from '@shared/providers'
import type { StatusSnapshot } from '@shared/ipc'
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

const HEALTH_POLL_MS = 5000

export function StatusBar({
  micState,
  lastProvider,
  busy,
  theme,
  updateLabel: updateBadge,
  wakeStatus,
  onCycleTheme,
  onOpenSettings,
  onUpdateOpen
}: StatusBarProps) {
  const [snapshot, setSnapshot] = useState<StatusSnapshot | null>(null)

  useEffect(() => {
    let alive = true
    const tick = (): void => {
      void window.ashirs.getStatusSnapshot().then((next) => {
        if (alive) setSnapshot(next)
      })
    }
    tick()
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') tick()
    }, HEALTH_POLL_MS)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [])

  const micLabel = micState === 'listening' ? 'LIVE' : micState === 'denied' ? 'DENIED' : 'READY'
  const micTone =
    micState === 'listening'
      ? 'bg-accent animate-pulse'
      : micState === 'denied'
        ? 'bg-warning'
        : 'bg-ink-muted'
  const micTooltip =
    micState === 'listening'
      ? 'Microphone live — listening'
      : micState === 'denied'
        ? 'Microphone permission denied — enable it in Settings'
        : 'Microphone ready — tap the orb to speak'

  const primaryHealth = snapshot?.providers.find((p) => p.id === 'groq') ?? snapshot?.providers[0]
  const healthText = (() => {
    if (busy && lastProvider) return `${lastProvider.toUpperCase()} · THINKING`
    if (primaryHealth) {
      const tone = primaryHealth.state === 'cooling' ? 'RATE-LIMITED' : 'OK'
      return `${primaryHealth.id.toUpperCase()} ● ${tone}`
    }
    return 'NO PROVIDER'
  })()
  const healthTone = healthText.includes('OK')
    ? 'bg-ok'
    : healthText.includes('THINKING')
      ? 'bg-accent animate-pulse'
      : 'bg-warning'

  const agentText = snapshot ? `${snapshot.agents.working}/${snapshot.agents.total}` : '…/4'

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-edge bg-panel px-4">
      <div className="flex items-center gap-2.5">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            busy ? 'bg-accent animate-pulse' : 'bg-accent-dim'
          }`}
        />
        <span className="font-mono text-xs font-medium uppercase tracking-[0.25em] text-ink">
          Ashir&apos;s AI
        </span>
      </div>
      <div className="flex items-center gap-5 font-mono text-[11px] uppercase tracking-widest text-ink-muted">
        <span className="flex items-center gap-1.5" title={micTooltip}>
          <span className={`h-1.5 w-1.5 rounded-full ${micTone}`} />
          Mic {micLabel}
        </span>
        <span title="Working agents (Agent engines start in a later phase)">
          Agents {agentText}
        </span>
        <span className="flex items-center gap-1.5" title={healthText}>
          <span className={`h-1.5 w-1.5 rounded-full ${healthTone}`} />
          {healthText}
        </span>
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
        <button
          className={`update-pill ${updateBadge ? '' : 'opacity-80 hover:opacity-100'}`}
          title="Check for updates — opens the Update Center"
          onClick={onUpdateOpen}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              updateBadge ? 'bg-warning animate-pulse' : 'bg-ok'
            }`}
          />
          {updateBadge ?? 'UPDATE'}
        </button>
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
