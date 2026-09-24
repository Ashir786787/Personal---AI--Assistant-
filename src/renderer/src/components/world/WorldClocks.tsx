import { useEffect, useState } from 'react'

const ZONES: Array<{ label: string; zone: string }> = [
  { label: 'Karachi', zone: 'Asia/Karachi' },
  { label: 'London', zone: 'Europe/London' },
  { label: 'Berlin', zone: 'Europe/Berlin' },
  { label: 'New York', zone: 'America/New_York' },
  { label: 'Tokyo', zone: 'Asia/Tokyo' },
  { label: 'Sydney', zone: 'Australia/Sydney' }
]

function clockFor(zone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: zone
  }).format(new Date())
}

function offsetFor(zone: string): string | null {
  try {
    return (
      new Intl.DateTimeFormat('en-GB', {
        hour12: false,
        timeZone: zone,
        timeZoneName: 'shortOffset'
      })
        .formatToParts(new Date())
        .find((part) => part.type === 'timeZoneName')
        ?.value.replace('GMT', 'UTC') ?? null
    )
  } catch {
    return null
  }
}

export function WorldClocks() {
  const [, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="flex flex-col gap-3">
      {ZONES.map((zone) => {
        const offset = offsetFor(zone.zone)
        return (
          <div key={zone.zone} className="world-clock items-start px-4 text-left">
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-muted">
              {zone.label}
            </span>
            <strong>{clockFor(zone.zone)}</strong>
            <span className="font-mono text-[10px] uppercase tracking-widest text-ink/50">
              {offset ?? 'local'}
            </span>
          </div>
        )
      })}
    </div>
  )
}
