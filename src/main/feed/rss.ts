import type { FeedItem, FeedSourceResult } from '@shared/feed'
import { sanitizeFeedUrl } from '@shared/feed'

export const FEED_TIMEOUT_MS = 10_000
export const MAX_FEED_BYTES = 1_000_000
export const MAX_ITEMS_PER_FEED = 25
export const MAX_TEXT_CHARS = 300

const ENTITY_MAP: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00A0'
}

// Decoders never expand custom or nested entities: text is scanned left to
// right and only the fixed whitelist above is replaced, so a billion-laughs
// style payload cannot grow the document during parsing.
function decodeEntities(input: string): string {
  return input
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_m, name: string) => ENTITY_MAP[name] ?? _m)
    .replace(/&#(\d{1,7});/g, (_m, d: string) => {
      const code = Number(d)
      return code > 31 && code < 0x110000 ? String.fromCodePoint(code) : _m
    })
}

function unwrapCdata(input: string): string {
  return input.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
}

function tagInner(block: string, name: string): string | null {
  const open = new RegExp(`<${name}(?:[^>]*)>`, 'i')
  const match = open.exec(block)
  if (!match) return null
  const start = match.index + match[0].length
  // First close tag wins; feeds do not nest the standard RSS/Atom tags.
  const close = new RegExp(`<\\/${name}>`, 'i').exec(block.slice(start))
  if (!close) return null
  return block.slice(start, start + close.index)
}

function attr(block: string, name: string): string | null {
  const match = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(block)
  return match ? (match[1] ?? null) : null
}

export function extractText(html: string, maxLength: number): string {
  const withoutCdata = unwrapCdata(html)
  // Decode the whitelist first so escaped markup (e.g. &lt;p&gt;) is treated
  // exactly like real markup, then strip tags for plain text rendering.
  const decoded = decodeEntities(withoutCdata)
  const stripped = decoded
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (stripped.length <= maxLength) return stripped
  return `${stripped.slice(0, maxLength)}\u2026`
}

function publishedAt(value: string | null): string | null {
  if (!value) return null
  const date = new Date(extractText(value, 200))
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function rssItem(block: string, source: string, index: number): FeedItem | null {
  const title = tagInner(block, 'title')
  if (!title) return null
  const rawLink = extractText(tagInner(block, 'link') ?? '', 400).trim()
  const href = attr(block, 'href') ? extractText(attr(block, 'href')!, 400).trim() : ''
  const url = sanitizeFeedUrl(rawLink) ?? sanitizeFeedUrl(href) ?? rawLink
  const description =
    tagInner(block, 'description') ?? tagInner(block, 'summary') ?? tagInner(block, 'content')
  const text = description ? extractText(description, MAX_TEXT_CHARS) : undefined
  return {
    id: `${source}#${index}`,
    source,
    title: extractText(title, 200),
    url,
    text,
    publishedAt: publishedAt(tagInner(block, 'pubDate') ?? tagInner(block, 'updated'))
  }
}

export function parseRss(xml: string, source: string): FeedItem[] {
  const items: FeedItem[] = []
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi
  let itemMatch: RegExpExecArray | null
  while ((itemMatch = itemRegex.exec(xml)) !== null) {
    const parsed = rssItem(itemMatch[1] ?? '', source, items.length)
    if (parsed) items.push(parsed)
    if (items.length >= MAX_ITEMS_PER_FEED) break
  }
  if (items.length > 0) return items

  // Atom fallback for feeds that declare <entry> instead of <item>.
  const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi
  let entryMatch: RegExpExecArray | null
  while ((entryMatch = entryRegex.exec(xml)) !== null) {
    const parsed = rssItem(entryMatch[1] ?? '', source, items.length)
    if (parsed) items.push(parsed)
    if (items.length >= MAX_ITEMS_PER_FEED) break
  }
  return items
}

export async function fetchAndParseRss(url: string): Promise<FeedSourceResult> {
  const safe = sanitizeFeedUrl(url)
  if (!safe) return { url, ok: false, error: 'Only https feeds are allowed', items: [] }

  let response: Response
  try {
    // Node's fetch has no cookie jar attached, so feeds cannot persist or
    // send cookies during the request.
    response = await fetch(safe, { signal: AbortSignal.timeout(FEED_TIMEOUT_MS) })
  } catch (err) {
    const message =
      err instanceof Error && err.name === 'TimeoutError' ? 'timed out after 10s' : 'network error'
    return { url: safe, ok: false, error: message, items: [] }
  }

  if (!response.ok) {
    return { url: safe, ok: false, error: `HTTP ${response.status}`, items: [] }
  }

  let body: string
  try {
    body = await response.text()
  } catch {
    return { url: safe, ok: false, error: 'response unreadable', items: [] }
  }
  if (body.length > MAX_FEED_BYTES) {
    return { url: safe, ok: false, error: 'feed exceeded 1 MB cap', items: [] }
  }
  return { url: safe, ok: true, items: parseRss(body, safe) }
}
