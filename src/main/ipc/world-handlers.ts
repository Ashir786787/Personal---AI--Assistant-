import { ipcMain, shell } from 'electron'
import type { FeedBatch } from '@shared/feed'
import { sanitizeFeedUrl } from '@shared/feed'
import { IPC } from '@shared/ipc'
import { fetchAndParseRss } from '../feed/rss'

const MAX_SOURCES = 20

export function registerWorldIpc(): void {
  ipcMain.handle(IPC.feedFetch, async (_event, raw: unknown): Promise<FeedBatch> => {
    if (!Array.isArray(raw)) throw new Error('expected a list of feed urls')
    const seen = new Set<string>()
    const sources: string[] = []
    for (const entry of raw) {
      const safe = sanitizeFeedUrl(String(entry ?? ''))
      if (!safe || seen.has(safe)) continue
      seen.add(safe)
      sources.push(safe)
      if (sources.length >= MAX_SOURCES) break
    }

    const results = await Promise.all(sources.map((url) => fetchAndParseRss(url)))
    return { results }
  })

  ipcMain.handle(IPC.feedOpenExternal, async (_event, raw: unknown): Promise<void> => {
    const safe = sanitizeFeedUrl(String(raw ?? ''))
    if (!safe) throw new Error('Only https links can be opened')
    await shell.openExternal(safe)
  })
}
