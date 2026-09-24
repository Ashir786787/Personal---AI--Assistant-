import { useCallback, useMemo, useRef, useState } from 'react'
import type { FeedItem, FeedSourceResult, Hotspot } from '@shared/feed'
import { DEFAULT_FEED_SOURCES, matchHotspots, sanitizeFeedUrl } from '@shared/feed'
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

  const refreshWith = useCallback(async (list: string[]): Promise<void> => {
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

  const refresh = useCallback((): Promise<void> => refreshWith(sourcesRef.current), [refreshWith])

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
      const next = [...sourcesRef.current, safe]
      persistSources(next)
      // Fetches the newly computed list directly: the ref only updates on the
      // next render, so reading it here would fetch the pre-add empty list.
      void refreshWith(next)
      return null
    },
    [persistSources, refreshWith]
  )

  const removeSource = useCallback(
    (url: string): void => {
      const next = sourcesRef.current.filter((entry) => entry !== url)
      persistSources(next)
      void refreshWith(next)
    },
    [persistSources, refreshWith]
  )

  const setEnabled = useCallback(
    (value: boolean): void => {
      setEnabledState(value)
      localStorage.setItem(ENABLED_KEY, value ? '1' : '0')
      if (value) {
        const current = sourcesRef.current
        if (current.length === 0) {
          const defaults = DEFAULT_FEED_SOURCES.filter(
            (entry) => sanitizeFeedUrl(entry) !== null
          ) as string[]
          persistSources(defaults)
          void refreshWith(defaults)
        } else {
          void refreshWith(current)
        }
      }
    },
    [persistSources, refreshWith]
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
