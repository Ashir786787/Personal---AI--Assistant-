import { useEffect, useState } from 'react'
import { Tabs, type TabItem } from '../ui/Tabs'
import { GlobeCanvas } from './GlobeCanvas'
import { MapCanvas } from './MapCanvas'
import { WorldClocks } from './WorldClocks'
import { HeadlinesFeed } from './HeadlinesFeed'
import { useWorldFeed } from '../../hooks/useWorldFeed'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { LAND_SOURCE } from '../../state/land'

const TABS: TabItem[] = [
  { id: 'globe', label: 'Globe' },
  { id: 'map', label: 'Map' }
]

function utcClock(): string {
  return new Date().toISOString().slice(11, 19).concat('Z')
}

export function WorldMonitor() {
  const [tab, setTab] = useState('globe')
  const feed = useWorldFeed()
  const { reduced } = useReducedMotion()
  const [, setTick] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => setTick((t) => t + 1), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="flex h-full w-full flex-col gap-4 p-5">
      <header className="glass flex items-center justify-between rounded-xl px-4 py-3">
        <div>
          <h2 className="font-mono text-[11px] uppercase tracking-[0.35em] text-accent">
            World Monitor
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            Headlines and mapping, all local until you opt in
          </p>
        </div>
        <div className="text-right">
          <div className="font-mono text-[22px] leading-none text-ink">{utcClock()}</div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-muted">UTC</div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-4">
        <aside className="w-[150px] shrink-0 overflow-y-auto">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-muted">
              World clocks
            </span>
          </div>
          <WorldClocks />
        </aside>

        <main className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between">
            <Tabs tabs={TABS} active={tab} onChange={setTab} ariaLabel="World projection" />
            <span className="font-mono text-[9px] uppercase tracking-widest text-ink/30">
              {LAND_SOURCE}
            </span>
          </div>
          <div className="glass relative min-h-0 flex-1 overflow-hidden rounded-xl">
            {tab === 'globe' ? (
              <GlobeCanvas hotspots={feed.hotspots} reduced={reduced} />
            ) : (
              <MapCanvas hotspots={feed.hotspots} />
            )}
            <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-base/70 px-2.5 py-1 font-mono text-[10px] tracking-wider text-ink/45">
              {tab === 'globe' ? 'drag to rotate · scroll to zoom' : 'drag to pan · scroll to zoom'}
            </div>
            <div className="pointer-events-none absolute bottom-3 right-3 rounded-lg bg-base/70 px-2.5 py-1 font-mono text-[10px] tracking-wider text-ink/55">
              {feed.hotspots.length === 0
                ? 'no hotspots — headlines with country names appear here'
                : `${feed.hotspots.length} hotspot${feed.hotspots.length === 1 ? '' : 's'}`}
            </div>
          </div>
        </main>

        <aside className="w-[300px] shrink-0">
          <HeadlinesFeed feed={feed} />
        </aside>
      </div>
    </div>
  )
}
