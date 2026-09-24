import { useEffect, useState } from 'react'
import type { SystemStats } from '@shared/ipc'
import { Sparkline } from '../ui'
import { appendSample, SPARK_MAX_SAMPLES } from '../../state/systemHistory'

interface SampleSets {
  cpu: number[]
  ram: number[]
  disk: number[]
  battery: number[]
  uptime: number[]
}

const EMPTY_SAMPLES: SampleSets = {
  cpu: [],
  ram: [],
  disk: [],
  battery: [],
  uptime: []
}

const POLL_MS = 2000

function Gauge({
  label,
  ringValue,
  valueText,
  detail,
  samples,
  sparkLabel
}: {
  label: string
  ringValue: number | null
  valueText: string
  detail?: string
  samples: readonly number[]
  sparkLabel: string
}): JSX.Element {
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const swept =
    ringValue === null ? 0 : (Math.min(100, Math.max(0, ringValue)) / 100) * circumference
  return (
    <div className="glass flex min-w-0 items-center gap-4 rounded-xl p-4">
      <div className="relative h-24 w-24 shrink-0">
        <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="rgb(var(--c-edge))"
            strokeWidth="7"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="rgb(var(--c-accent))"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${swept} ${circumference}`}
            className="transition-[stroke-dasharray] duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-lg font-semibold text-ink">{valueText}</span>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="truncate font-mono text-[11px] uppercase tracking-[0.25em] text-accent">
          {label}
        </p>
        <Sparkline
          data={samples}
          label={sparkLabel}
          className="h-7 w-full max-w-[9rem] text-accent"
        />
        {detail && <p className="truncate text-[11px] text-ink-muted">{detail}</p>}
      </div>
    </div>
  )
}

export function SystemView(): JSX.Element {
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [samples, setSamples] = useState<SampleSets>(EMPTY_SAMPLES)

  useEffect(() => {
    let alive = true
    const poll = (): void => {
      if (document.visibilityState !== 'visible') return
      void window.ashirs.systemStats().then((next) => {
        if (!alive) return
        setStats(next)
        const diskPercent =
          next.diskTotalGb && next.diskFreeGb !== null
            ? Math.round((1 - next.diskFreeGb / next.diskTotalGb) * 100)
            : null
        setSamples((prev) => ({
          cpu: appendSample(prev.cpu, next.cpuPercent),
          ram: appendSample(prev.ram, next.ramPercent),
          disk: diskPercent === null ? prev.disk : appendSample(prev.disk, diskPercent),
          battery:
            next.batteryPercent === null
              ? prev.battery
              : appendSample(prev.battery, next.batteryPercent),
          uptime: appendSample(prev.uptime, next.uptimeHours)
        }))
      })
    }
    poll()
    const timer = window.setInterval(poll, POLL_MS)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [])

  const diskPercent =
    stats && stats.diskTotalGb && stats.diskFreeGb !== null
      ? Math.round((1 - stats.diskFreeGb / stats.diskTotalGb) * 100)
      : null

  return (
    <div className="flex h-full w-full flex-col gap-4 p-5">
      <div className="glass flex items-center justify-between gap-4 rounded-xl px-4 py-3">
        <div>
          <h2 className="font-mono text-[11px] uppercase tracking-[0.35em] text-accent">
            System Core
          </h2>
          <p className="mt-1 text-xs text-ink-muted">
            Read-only vitals — this view can never change anything
          </p>
        </div>
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
          Last {SPARK_MAX_SAMPLES} readings · 2s · while visible
        </span>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-5 auto-rows-min gap-3">
        <Gauge
          label="CPU"
          ringValue={stats?.cpuPercent ?? null}
          valueText={stats ? `${stats.cpuPercent}%` : '—'}
          samples={samples.cpu}
          sparkLabel="CPU load per 2-second reading"
        />
        <Gauge
          label="Memory"
          ringValue={stats?.ramPercent ?? null}
          valueText={stats ? `${stats.ramPercent}%` : '—'}
          detail={stats ? `${stats.ramUsedGb} / ${stats.ramTotalGb} GB` : undefined}
          samples={samples.ram}
          sparkLabel="Memory use per 2-second reading"
        />
        <Gauge
          label="Disk C:"
          ringValue={diskPercent}
          valueText={diskPercent === null ? '—' : `${diskPercent}%`}
          detail={stats?.diskFreeGb != null ? `${stats.diskFreeGb} GB free` : undefined}
          samples={samples.disk}
          sparkLabel="Disk usage per 2-second reading"
        />
        <Gauge
          label="Battery"
          ringValue={stats?.batteryPercent ?? null}
          valueText={stats?.batteryPercent != null ? `${stats.batteryPercent}%` : '—'}
          detail={stats?.batteryPercent == null ? 'No battery detected' : undefined}
          samples={samples.battery}
          sparkLabel="Battery level per 2-second reading"
        />
        <Gauge
          label="Uptime"
          ringValue={null}
          valueText={stats ? `${stats.uptimeHours} h` : '—'}
          samples={samples.uptime}
          sparkLabel="Uptime in hours per 2-second reading"
        />
      </div>
    </div>
  )
}
