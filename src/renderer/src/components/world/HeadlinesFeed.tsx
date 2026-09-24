import { useState } from 'react'
import type { FeedSourceResult } from '@shared/feed'
import type { useWorldFeed } from '../../hooks/useWorldFeed'
import { Button } from '../ui/Button'

type FeedApi = ReturnType<typeof useWorldFeed>

const PRESETS: Array<{ label: string; url: string }> = [
  { label: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { label: 'BBC Urdu', url: 'https://feeds.bbci.co.uk/urdu/rss.xml' },
  { label: 'The Guardian', url: 'https://www.theguardian.com/world/rss' },
  { label: 'NYT World', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml' },
  { label: 'Dawn (PK)', url: 'https://www.dawn.com/feeds/home' }
]

function timeLabel(timestamp: number | null): string {
  if (timestamp === null) return 'never refreshed'
  const diff = Math.max(0, Date.now() - timestamp)
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  return `${Math.floor(minutes / 60)}h ago`
}

export function HeadlinesFeed({ feed }: { feed: FeedApi }) {
  const [draft, setDraft] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  if (!feed.enabled) {
    return (
      <div className="glass flex flex-col gap-3 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink-muted">
            Headlines feed
          </span>
          <span className="update-pill opacity-70">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
            OFF
          </span>
        </div>
        <p className="text-xs text-ink-muted">
          Nothing loads from the internet until you enable it. Only https RSS feeds you add will be
          fetched, with a 10s timeout and a 1 MB size cap per source.
        </p>
        <Button variant="primary" size="sm" onClick={() => feed.setEnabled(true)}>
          Enable feed
        </Button>
      </div>
    )
  }

  const allFailed =
    feed.results !== null &&
    feed.results.length > 0 &&
    feed.results.every((result: FeedSourceResult) => !result.ok)

  const submit = (): void => {
    if (draft.trim().length === 0) return
    const first = feed.sources.length === 0
    const err = feed.addSource(draft.trim())
    setNotice(err)
    if (err === null) {
      setDraft('')
      if (first) void feed.refresh()
    }
  }

  const addPreset = (url: string): void => {
    const first = feed.sources.length === 0
    const err = feed.addSource(url)
    setNotice(err)
    if (err === null && first) void feed.refresh()
  }

  return (
    <div className="glass flex min-h-0 flex-col gap-3 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink-muted">
          Headlines feed
        </span>
        <div className="flex items-center gap-2">
          <span className="update-pill">
            <span className={`h-1.5 w-1.5 rounded-full ${feed.loading ? 'bg-accent' : 'bg-ok'}`} />
            {feed.loading ? 'FETCHING' : 'LIVE'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void feed.refresh()}
            disabled={feed.loading}
          >
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit()
          }}
          placeholder="https://feed.example.com/rss.xml"
          className="min-w-0 flex-1 rounded-lg border border-ink/10 bg-base/60 px-3 py-1.5 font-mono text-[11px] text-ink placeholder:text-ink/35 focus:border-accent/60 focus:outline-none"
          aria-label="Add a feed url"
        />
        <Button variant="ghost" size="sm" onClick={submit}>
          Add
        </Button>
      </div>
      {notice && <p className="text-xs text-warn">{notice}</p>}
      {feed.error && <p className="text-xs text-warn">{feed.error}</p>}
      <p className="text-[11px] text-ink/45">
        {feed.sources.length} source(s) · stored locally · {timeLabel(feed.refreshedAt)}
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/45">
          Quick add
        </span>
        {PRESETS.map((preset) => (
          <button
            key={preset.url}
            type="button"
            onClick={() => addPreset(preset.url)}
            className="chip rounded-full text-ink/60 transition-colors hover:border-accent/50 hover:text-accent"
            title={`Add ${preset.label} (${preset.url})`}
          >
            + {preset.label}
          </button>
        ))}
      </div>

      {feed.sources.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {feed.sources.map((source) => (
            <span key={source} className="chip chip-neutral flex items-center gap-1">
              {source.replace('https://', '').slice(0, 40)}
              <button
                onClick={() => feed.removeSource(source)}
                className="text-ink/45 transition-colors hover:text-danger"
                aria-label={`Remove ${source}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {feed.results === null && !feed.loading && (
          <p className="text-xs text-ink/60">Add at least one https RSS feed, then refresh.</p>
        )}
        {allFailed && (
          <p className="text-xs text-warn">
            Every source failed to load — check that the feeds are reachable and returning RSS.
          </p>
        )}
        <ul className="mt-2 space-y-2">
          {feed.items.map((item) => (
            <li key={item.id} className="headline-row">
              <button
                onClick={() => void feed.openItem(item)}
                className="text-left text-sm leading-snug text-ink/80 transition-colors hover:text-accent"
                title={
                  item.url.startsWith('https://') ? 'Open in browser' : 'https only — cannot open'
                }
              >
                {item.title}
              </button>
              {item.text && (
                <p className="mt-1 text-[11px] leading-snug text-ink/45">{item.text}</p>
              )}
              <span className="mt-1 block font-mono text-[9px] uppercase tracking-widest text-ink/30">
                {item.source.replace('https://', '').slice(0, 30)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
