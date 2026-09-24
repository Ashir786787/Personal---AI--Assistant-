import { describe, expect, it } from 'vitest'
import { sanitizeFeedUrl } from '../../src/shared/feed'
import { MAX_ITEMS_PER_FEED, parseRss } from '../../src/main/feed/rss'

describe('feed security rails (spec 5.3)', () => {
  it('only accepts clean https urls', () => {
    expect(sanitizeFeedUrl('https://example.com/feed.xml')).toBe('https://example.com/feed.xml')
    expect(sanitizeFeedUrl('  https://example.com/feed.xml  ')).toBe('https://example.com/feed.xml')
    expect(sanitizeFeedUrl('http://example.com/feed.xml')).toBeNull()
    expect(sanitizeFeedUrl('file:///etc/passwd')).toBeNull()
    expect(sanitizeFeedUrl('javascript:alert(1)')).toBeNull()
    expect(sanitizeFeedUrl('https://user:pass@example.com/feed.xml')).toBeNull()
    expect(sanitizeFeedUrl('not a url')).toBeNull()
  })

  it('never expands foreign entities (billion-laughs safe)', () => {
    const xml = `<?xml version="1.0"?><rss><channel><item><title>&larr;&hearts;&notarealentity;</title></item></rss>`
    const items = parseRss(xml, 'https://example.com/feed.xml')
    expect(items[0]!.title).toContain('&hearts;')
    expect(items[0]!.title).toContain('&notarealentity;')
  })

  it('decodes the whitelisted entities only', () => {
    const xml = `<?xml version="1.0"?><rss><channel><item><title>Bread &amp; Butter &lt;3 &quot;quote&quot;</title></item></rss>`
    const items = parseRss(xml, 'https://example.com/feed.xml')
    expect(items[0]!.title).toBe('Bread & Butter <3 "quote"')
  })

  it('extracts plain text summaries from html descriptions', () => {
    const xml = `<rss><channel><item>
      <title>Storm warnings</title>
      <link>https://example.com/story</link>
      <description>&lt;p&gt;Heavy &lt;b&gt;rain&lt;/b&gt; hits the coast.&lt;/p&gt;</description>
      <pubDate>Wed, 24 Sep 2025 09:30:00 GMT</pubDate>
    </item></rss>`
    const items = parseRss(xml, 'https://example.com/feed.xml')
    expect(items[0]!.title).toBe('Storm warnings')
    expect(items[0]!.url).toBe('https://example.com/story')
    expect(items[0]!.text).toBe('Heavy rain hits the coast.')
    expect(items[0]!.publishedAt).toBe('2025-09-24T09:30:00.000Z')
  })

  it('handles CDATA wrapped titles', () => {
    const xml = `<rss><channel><item><title><![CDATA[Closed &amp; Open]]></title><link>https://example.com/1</link></item></rss>`
    const items = parseRss(xml, 'https://example.com/feed.xml')
    expect(items[0]!.title).toBe('Closed & Open')
  })

  it('caps the number of items per feed', () => {
    const block = (i: number): string =>
      `<item><title>Item ${i}</title><link>https://example.com/${i}</link></item>`
    const xml = `<rss><channel>${Array.from({ length: 40 }, (_, i) => block(i)).join('')}</channel></rss>`
    const items = parseRss(xml, 'https://example.com/feed.xml')
    expect(items.length).toBeLessThanOrEqual(MAX_ITEMS_PER_FEED)
  })

  it('falls back to atom entries', () => {
    const xml = `<?xml version="1.0"?><feed>
      <entry><title>Atom headline</title><link href="https://example.com/atom-1"/><updated>2026-01-02T03:04:05Z</updated></entry>
      <entry><title>Second</title><link href="https://example.com/atom-2"/></entry>
    </feed>`
    const items = parseRss(xml, 'https://example.com/feed.xml')
    expect(items.map((item) => item.title)).toEqual(['Atom headline', 'Second'])
    expect(items[0]!.url).toBe('https://example.com/atom-1')
    expect(items[0]!.publishedAt).toBe('2026-01-02T03:04:05.000Z')
  })
})
