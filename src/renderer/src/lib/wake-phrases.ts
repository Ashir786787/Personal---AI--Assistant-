export const WAKE_PHRASES = ['jarvis', 'hey dude', 'hey ashirs ai', 'hey ashirs'] as const

const PUNCTUATION_RE = /[^a-z\s]/g

export function normalizeForWake(text: string): string {
  return text.toLowerCase().replace(PUNCTUATION_RE, '').replace(/\s+/g, ' ').trim()
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m

  let prev: number[] = new Array(n + 1)
  let curr: number[] = new Array(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j

  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const del = prev[j]! + 1
      const ins = curr[j - 1]! + 1
      const sub = prev[j - 1]! + cost
      curr[j] = Math.min(del, ins, sub)
    }
    const swap = prev
    prev = curr
    curr = swap
  }
  return prev[n]!
}

function toleranceFor(length: number): number {
  if (length >= 10) return 3
  if (length >= 6) return 2
  return 1
}

/**
 * Checks a normalized partial transcript for a wake phrase.
 * Slides a token window across the text so "well hey dude what" matches.
 * Returns the matched phrase, or null.
 */
export function matchesWakePhrase(
  normalized: string,
  options?: { tolerance?: number }
): string | null {
  const text = normalizeForWake(normalized)
  if (text.length === 0) return null
  const tokens = text.split(' ')

  for (const phrase of WAKE_PHRASES) {
    const phraseTokens = phrase.split(' ')
    const windowSize = phraseTokens.length
    if (tokens.length < windowSize) continue

    for (let start = 0; start <= tokens.length - windowSize; start++) {
      const slice = tokens.slice(start, start + windowSize).join(' ')
      const tolerance = options?.tolerance ?? toleranceFor(phrase.length)
      if (levenshtein(slice, phrase) <= tolerance) {
        return phrase
      }
    }
  }
  return null
}
