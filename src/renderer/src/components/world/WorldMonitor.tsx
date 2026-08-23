import { useEffect, useState } from 'react'

const ZONES = [
  { label: 'UTC', offsetHours: 0 },
  { label: 'Karachi', offsetHours: 5 },
  { label: 'New York', offsetHours: -4 },
  { label: 'London', offsetHours: 1 },
  { label: 'Tokyo', offsetHours: 9 }
]

const PLACEHOLDER_HEADLINES = [
  'Live headlines are one approval away',
  'Opt in later and this feed lights up with world news',
  'Nothing loads from the internet without your say-so',
  'Your command center, your rules'
]

function clockFor(offsetHours: number): string {
  const now = new Date()
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes() + offsetHours * 60
  const wrapped = ((utcMinutes % 1440) + 1440) % 1440
  const h = Math.floor(wrapped / 60)
  const m = wrapped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function WorldMonitor(): JSX.Element {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => setTick((t) => t + 1), 15_000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="flex h-full w-full flex-col gap-4 p-5">
      <div className="glass rounded-xl p-4">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.35em] text-accent">
          World Monitor
        </h2>
        <p className="mt-1 text-xs text-ink-muted">
          Time across your zones — always local math, no network
        </p>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {ZONES.map((zone) => (
          <div key={zone.label} className="world-clock">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">
              {zone.label}
            </span>
            <strong>{clockFor(zone.offsetHours)}</strong>
          </div>
        ))}
      </div>

      <div className="glass min-h-0 flex-1 overflow-y-auto rounded-xl p-4" key={tick}>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-muted">
            Headlines feed
          </span>
          <span className="update-pill opacity-70">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
            OFFLINE
          </span>
        </div>
        <ul className="mt-3 space-y-2">
          {PLACEHOLDER_HEADLINES.map((line) => (
            <li key={line} className="headline-row">
              <span className="text-sm text-ink/70">{line}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
