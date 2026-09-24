import { useCallback, useMemo, useRef, useState } from 'react'
import type { FeedItem, FeedSourceResult, Hotspot } from '@shared/feed'
import { matchHotspots, sanitizeFeedUrl } from '@shared/feed'
import { GAZETTEER } from '../state/land'

const ENABLED_KEY = 'ashirs.feed.enabled'
const SOURCES_KEY = 'ashirs.feed.sources'

function readSources(): string[] {
  try {
    const raw = localStorage.getItem(SOURCES_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((entry) => String(entry)).filter((entry) => sanitizeFeedUrl(entry) !== null)
  } catch {
    return []
  }
}

export function useWorldFeed() {
  const [enabled, setEnabledState] = useState(() => localStorage.getItem(ENABLED_KEY) === '1')
  const [sources, setSources] = useState<string[]>(readSources)
  const [results, setResults] = useState<FeedSourceResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshedAt, setRefreshedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const sourcesRef = useRef(sources)
  sourcesRef.current = sources

  const refresh = useCallback(async (): Promise<void> => {
    const list = sourcesRef.current
    if (list.length === 0) {
      setResults(null)
      setRefreshedAt(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const batch = await window.ashirs.fetchFeeds(list)
      setResults(batch.results)
      setRefreshedAt(Date.now())
    } catch (err) {
      const message = err instanceof Error ? err.message : 'feed request failed'
      setError(message)
      setResults(null)
      setRefreshedAt(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const persistSources = useCallback((next: string[]): void => {
    setSources(next)
    localStorage.setItem(SOURCES_KEY, JSON.stringify(next))
    setResults(null)
    setRefreshedAt(null)
  }, [])

  const addSource = useCallback(
    (raw: string): string | null => {
      const safe = sanitizeFeedUrl(raw)
      if (!safe) return 'Only https RSS feed urls are accepted'
      if (sourcesRef.current.includes(safe)) return 'That feed is already in the list'
      persistSources([...sourcesRef.current, safe])
      return null
    },
    [persistSources]
  )

  const removeSource = useCallback(
    (url: string): void => {
      persistSources(sourcesRef.current.filter((entry) => entry !== url))
    },
    [persistSources]
  )

  const setEnabled = useCallback(
    (value: boolean): void => {
      setEnabledState(value)
      localStorage.setItem(ENABLED_KEY, value ? '1' : '0')
      if (value) void refresh()
    },
    [refresh]
  )

  const items = useMemo<FeedItem[]>(
    () => (results ? results.flatMap((result) => result.items) : []),
    [results]
  )

  const hotspots = useMemo<Hotspot[]>(() => matchHotspots(items, GAZETTEER), [items])

  const openItem = useCallback(async (item: FeedItem): Promise<void> => {
    if (sanitizeFeedUrl(item.url) !== null) {
      await window.ashirs.openExternalIfHttps(item.url)
    }
  }, [])

  return {
    enabled,
    setEnabled,
    sources,
    addSource,
    removeSource,
    loading,
    refreshedAt,
    results,
    error,
    refresh,
    items,
    hotspots,
    openItem
  }
}
