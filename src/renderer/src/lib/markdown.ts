export type InlineToken =
  | { type: 'text'; text: string }
  | { type: 'bold'; children: InlineToken[] }
  | { type: 'italic'; children: InlineToken[] }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; children: InlineToken[] }

export type Block =
  | { type: 'para'; tokens: InlineToken[] }
  | { type: 'heading'; level: number; tokens: InlineToken[] }
  | { type: 'list'; ordered: boolean; items: InlineToken[][] }
  | { type: 'code'; code: string }

const MARKERS = new Set(['*', '`', '['])

function plain(tokens: InlineToken[]): string {
  let out = ''
  for (const token of tokens) {
    if (token.type === 'text' || token.type === 'code') out += token.text
    else out += plain(token.children)
  }
  return out
}

function findClosing(input: string, from: number, needle: string): number {
  let i = from
  while (i < input.length) {
    if (input.startsWith(needle, i)) return i
    i += 1
  }
  return -1
}

function parseInline(input: string, pos: number): { token: InlineToken; next: number } {
  const marker = input[pos] ?? ''

  if (marker === '`') {
    const end = input.indexOf('`', pos + 1)
    if (end === -1) return { token: { type: 'text', text: marker }, next: pos + 1 }
    return { token: { type: 'code', text: input.slice(pos + 1, end) }, next: end + 1 }
  }

  if (marker === '*') {
    const strong = input[pos + 1] === '*'
    const open = strong ? pos + 2 : pos + 1
    const needle = strong ? '**' : '*'
    const close = findClosing(input, open, needle)
    if (close === -1) return { token: { type: 'text', text: marker }, next: pos + 1 }
    const inner = tokenizeInline(input.slice(open, close))
    return {
      token: strong ? { type: 'bold', children: inner } : { type: 'italic', children: inner },
      next: close + needle.length
    }
  }

  if (marker === '[') {
    const labelEnd = input.indexOf('](', pos + 1)
    if (labelEnd === -1) return { token: { type: 'text', text: marker }, next: pos + 1 }
    const hrefEnd = input.indexOf(')', labelEnd + 2)
    if (hrefEnd === -1) return { token: { type: 'text', text: marker }, next: pos + 1 }
    const label = tokenizeInline(input.slice(pos + 1, labelEnd))
    const href = input.slice(labelEnd + 2, hrefEnd).trim()
    return { token: { type: 'link', href, children: label }, next: hrefEnd + 1 }
  }

  return { token: { type: 'text', text: marker }, next: pos + 1 }
}

export function tokenizeInline(input: string): InlineToken[] {
  const tokens: InlineToken[] = []
  let pos = 0
  let textStart = 0
  while (pos < input.length) {
    const char = input[pos] ?? ''
    if (MARKERS.has(char)) {
      if (pos > textStart) tokens.push({ type: 'text', text: input.slice(textStart, pos) })
      const parsed = parseInline(input, pos)
      tokens.push(parsed.token)
      pos = Math.max(parsed.next, pos + 1)
      textStart = pos
    } else {
      pos += 1
    }
  }
  if (textStart < input.length) tokens.push({ type: 'text', text: input.slice(textStart) })
  return tokens
}

function headingLevel(line: string): number | null {
  const match = /^#{1,3} +/.exec(line)
  return match ? match[0].length - 1 : null
}

function listOrdered(line: string): boolean | null {
  if (/^[-*] +/.test(line)) return false
  if (/^\d+\. +/.test(line)) return true
  return null
}

const LIST_MARKER = /^([-*]|\d+\.) +/

export function parseBlocks(md: string): Block[] {
  const blocks: Block[] = []
  const lines = md.split(/\r?\n/)
  let i = 0

  const isFence = (line: string | undefined): boolean => (line ?? '').startsWith('```')
  const isList = (line: string | undefined): boolean => listOrdered(line ?? '') !== null
  const isBlockStart = (line: string | undefined): boolean => {
    const value = line ?? ''
    return value !== '' && !isFence(value) && headingLevel(value) === null && !isList(value)
  }

  while (i < lines.length) {
    const line = lines[i] ?? ''

    if (line === '') {
      i += 1
      continue
    }

    if (isFence(line)) {
      const code: string[] = []
      i += 1
      while (i < lines.length && !isFence(lines[i])) {
        code.push(lines[i] ?? '')
        i += 1
      }
      if (i < lines.length) i += 1
      blocks.push({ type: 'code', code: code.join('\n') })
      continue
    }

    const level = headingLevel(line)
    if (level !== null) {
      blocks.push({ type: 'heading', level, tokens: tokenizeInline(line.slice(level + 1)) })
      i += 1
      continue
    }

    const ordered = listOrdered(line)
    if (ordered !== null) {
      const items: InlineToken[][] = []
      while (i < lines.length) {
        const current = lines[i] ?? ''
        if (listOrdered(current) !== ordered) break
        items.push(tokenizeInline(current.replace(LIST_MARKER, '')))
        i += 1
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }

    const paragraph: string[] = []
    while (i < lines.length && isBlockStart(lines[i])) {
      paragraph.push(lines[i] ?? '')
      i += 1
    }
    if (paragraph.length === 0) {
      i += 1
      continue
    }
    blocks.push({ type: 'para', tokens: tokenizeInline(paragraph.join('\n')) })
  }

  return blocks
}

/**
 * Only real https addresses may leave the app. The renderer renders this as inert
 * text; main re-checks the scheme again in world-handlers before opening anything.
 */
export function externalHref(href: string): string | null {
  const trimmed = href.trim()
  if (!/^https:\/\//i.test(trimmed)) return null
  try {
    const url = new URL(trimmed)
    return url.protocol === 'https:' && url.hostname.length > 0 ? url.toString() : null
  } catch {
    return null
  }
}

export function isExternalHref(href: string): boolean {
  return externalHref(href) !== null
}

export { plain as plainText }
