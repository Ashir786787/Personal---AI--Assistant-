import { useEffect, useState } from 'react'
import type { SystemStats } from '@shared/ipc'

function Gauge({
  label,
  percent,
  detail
}: {
  label: string
  percent: number | null
  detail?: string
}): JSX.Element {
  const value = percent ?? 0
  return (
    <div className="glass flex flex-col items-center gap-3 rounded-xl p-5">
      <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
        <circle cx="60" cy="60" r="52" fill="none" stroke="rgb(var(--c-edge))" strokeWidth="7" />
        <circle
          cx="60"
          cy="60"
          r="52"
          fill="none"
          stroke="rgb(var(--c-accent))"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * 2 * Math.PI * 52} ${2 * Math.PI * 52}`}
          className="transition-[stroke-dasharray] duration-700"
        />
      </svg>
      <div className="-mt-[104px] mb-[72px] text-center">
        <div className="font-mono text-xl font-semibold text-ink">
          {percent === null ? '—' : `${value}%`}
        </div>
      </div>
      <div className="text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">{label}</p>
        {detail && <p className="mt-1 text-xs text-ink-muted">{detail}</p>}
      </div>
    </div>
  )
}

export function SystemView(): JSX.Element {
  const [stats, setStats] = useState<SystemStats | null>(null)

  useEffect(() => {
    let alive = true
    const poll = (): void => {
      void window.ashirs.systemStats().then((next) => {
        if (alive) setStats(next)
      })
    }
    poll()
    const timer = window.setInterval(poll, 2500)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [])

  return (
    <div className="flex h-full w-full flex-col gap-4 p-5">
      <div className="glass rounded-xl p-4">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.35em] text-accent">
          System Core
        </h2>
        <p className="mt-1 text-xs text-ink-muted">
          Read-only vitals — this view can never change anything
        </p>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-4 gap-4">
        <Gauge label="CPU" percent={stats?.cpuPercent ?? null} />
        <Gauge
          label="Memory"
          percent={stats?.ramPercent ?? null}
          detail={stats ? `${stats.ramUsedGb} / ${stats.ramTotalGb} GB` : undefined}
        />
        <Gauge
          label="Battery"
          percent={stats?.batteryPercent ?? null}
          detail={stats?.batteryPercent == null ? 'No battery detected' : undefined}
        />
        <Gauge
          label="Disk C:"
          percent={
            stats && stats.diskFreeGb !== null && stats.diskTotalGb
              ? Math.round((1 - stats.diskFreeGb / stats.diskTotalGb) * 100)
              : null
          }
          detail={stats?.diskFreeGb != null ? `${stats.diskFreeGb} GB free` : undefined}
        />
      </div>
      <div className="glass rounded-xl p-4 font-mono text-xs text-ink-muted">
        Uptime {stats ? `${stats.uptimeHours} h` : '—'}
      </div>
    </div>
  )
}
