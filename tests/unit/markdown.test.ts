import { describe, expect, it } from 'vitest'
import {
  externalHref,
  isExternalHref,
  parseBlocks,
  plainText,
  tokenizeInline,
  type Block,
  type InlineToken
} from '../../src/renderer/src/lib/markdown'
import { formatElapsedMs, shortenPathLabel } from '../../src/renderer/src/lib/format'

function tokensOf(blocks: Block[], index: number): InlineToken[] {
  const block = blocks[index]
  if (!block || block.type === 'code' || block.type === 'list') {
    throw new Error(`block ${index} has no inline tokens`)
  }
  return block.tokens
}

describe('markdown parser', () => {
  it('tokenizes bold, italic, inline code and links', () => {
    const tokens = tokenizeInline('hi **boss** and *later* with `code` and [a link](https://x.dev)')
    expect(tokens.map((t) => t.type)).toEqual([
      'text',
      'bold',
      'text',
      'italic',
      'text',
      'code',
      'text',
      'link'
    ])
    const bold = tokens[1]
    expect(bold?.type === 'bold' && plainText(bold.children)).toBe('boss')
    const link = tokens[7]
    expect(link?.type === 'link' && link.href).toBe('https://x.dev')
  })

  it('leaves unmatched markers as plain text', () => {
    const tokens = tokenizeInline('unfinished * is plain')
    expect(tokens.every((t) => t.type === 'text')).toBe(true)
  })

  it('splits blocks into paragraphs, headings, lists and fenced code', () => {
    const md = '# Title\n\none\nline two\n\n- a\n- b\n\n```\nconst x = 1\n```\n\ndone'
    const blocks = parseBlocks(md)
    expect(blocks[0]).toMatchObject({ type: 'heading', level: 1 })
    expect(blocks[1]).toMatchObject({ type: 'para' })
    expect(plainText(tokensOf(blocks, 1))).toBe('one\nline two')
    expect(blocks[2]).toMatchObject({ type: 'list', ordered: false })
    expect(blocks[2]).toHaveProperty('items.length', 2)
    expect(blocks[3]).toMatchObject({ type: 'code', code: 'const x = 1' })
    expect(blocks[4]).toMatchObject({ type: 'para' })
  })

  it('parses ordered lists separately from unordered lists', () => {
    const blocks = parseBlocks('1. first\n2. second\n\n- loose')
    expect(blocks[0]).toMatchObject({ type: 'list', ordered: true })
    expect(blocks[0]).toHaveProperty('items.length', 2)
    expect(blocks[1]).toMatchObject({ type: 'list', ordered: false })
  })

  it('only allows https links to open externally', () => {
    expect(isExternalHref('https://example.com')).toBe(true)
    expect(isExternalHref('http://example.com')).toBe(false)
    expect(isExternalHref('javascript:alert(1)')).toBe(false)
    expect(isExternalHref('file:///c:/x')).toBe(false)
    expect(externalHref('https://ok.dev')).toBe('https://ok.dev/')
    expect(externalHref('http://nope.dev')).toBeNull()
  })

  it('keeps html-like input as inert text and never as a markup node', () => {
    const blocks = parseBlocks('<img src=x onerror=alert(1)> **fine**')
    const tokens = tokensOf(blocks, 0)
    expect(blocks.some((block) => block.type === ('html' as Block['type']))).toBe(false)
    expect(tokens[0]).toEqual({ type: 'text', text: '<img src=x onerror=alert(1)> ' })
    expect(tokens[1]?.type).toBe('bold')
  })
})

describe('format helpers', () => {
  it('formats elapsed durations honestly', () => {
    expect(formatElapsedMs(0)).toBe('0ms')
    expect(formatElapsedMs(500)).toBe('500ms')
    expect(formatElapsedMs(1234)).toBe('1.2s')
    expect(formatElapsedMs(8123)).toBe('8.1s')
    expect(formatElapsedMs(-3)).toBe('0s')
    expect(formatElapsedMs(Number.NaN)).toBe('0s')
  })

  it('shortens path labels to a few trailing segments', () => {
    expect(shortenPathLabel('Downloads')).toBe('Downloads')
    expect(shortenPathLabel('C:\\Users\\alice\\Desktop\\notes.txt')).toBe(
      '…alice\\Desktop\\notes.txt'
    )
    expect(shortenPathLabel('C:\\Users\\alice\\Desktop\\notes.txt', 5)).toBe(
      'Users\\alice\\Desktop\\notes.txt'
    )
    expect(shortenPathLabel('')).toBe('')
  })
})
