export interface FeedItem {
  id: string
  source: string
  title: string
  url: string
  text?: string
  publishedAt: string | null
}

export interface FeedSourceResult {
  url: string
  ok: boolean
  error?: string
  items: FeedItem[]
}

export interface FeedBatch {
  results: FeedSourceResult[]
}

export interface GazetteerCountry {
  name: string
  aliases: string[]
  lat: number
  lon: number
}

export interface Gazetteer {
  countries: GazetteerCountry[]
}

export interface Hotspot {
  name: string
  lat: number
  lon: number
  count: number
  sample: string
}

function urlDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function sanitizeFeedUrl(raw: string): string | null {
  const trimmed = urlDecode(String(raw).trim())
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null
  if (url.username !== '' || url.password !== '') return null
  return url.toString()
}

const BOUNDARY = '(^|[^a-z0-9])'
const DIVIDER = '(?=$|[^a-z0-9])'

export function matchHotspots(
  items: ReadonlyArray<Pick<FeedItem, 'title' | 'text'>>,
  gazetteer: Gazetteer
): Hotspot[] {
  const hotspots: Hotspot[] = []
  for (const country of gazetteer.countries) {
    let count = 0
    let match: string | null = null
    for (const item of items) {
      const haystack = `${item.title ?? ''} ${item.text ?? ''}`.toLowerCase()
      for (const label of [country.name, ...country.aliases]) {
        if (label.length < 2) continue
        if (new RegExp(`${BOUNDARY}${escape(label.toLowerCase())}${DIVIDER}`).test(haystack)) {
          count += 1
          if (!match) match = `${item.title ?? ''}`
          break
        }
      }
    }
    if (count > 0) {
      hotspots.push({
        name: country.name,
        lat: country.lat,
        lon: country.lon,
        count,
        sample: match ?? ''
      })
    }
  }
  return hotspots
}

function escape(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
