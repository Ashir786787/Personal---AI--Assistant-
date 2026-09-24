export const SPEECH_RATE = 1.3
export const MAX_SPEECH_CHARS = 420

const FENCE = /```[\s\S]*?```/g
const INLINE_CODE = /`([^`]+)`/g
const LINK = /\[([^\]]+)\]\([^)]*\)/g
const HEADING = /^#{1,6}\s+/gm
const MARKS = /[*_~#<>|]/g
const BULLET = /^\s*[-*]\s+/gm
const NUMBERED = /^\s*\d+\.\s+/gm
const WHITESPACE = /\s+/g
const TRAILING_PUNCT = /\s+[.,;:]+$/

/**
 * Turn the raw assistant markdown into a spoken form: drop code fences and
 * link targets, strip formatting marks, collapse whitespace, then cap the
 * length at a whole-word boundary so replies stay short out loud.
 */
export function speechText(input: string, maxLength = MAX_SPEECH_CHARS): string {
  const text = input
    .replace(FENCE, ' ')
    .replace(INLINE_CODE, '$1')
    .replace(LINK, '$1')
    .replace(HEADING, '')
    .replace(MARKS, '')
    .replace(BULLET, '')
    .replace(NUMBERED, '')
    .replace(WHITESPACE, ' ')
    .trim()

  if (text.length <= maxLength) return text
  const cut = text.slice(0, maxLength)
  const lastSpace = cut.lastIndexOf(' ')
  if (lastSpace > 0) {
    return cut.slice(0, lastSpace).replace(TRAILING_PUNCT, '').trim()
  }
  return cut.trim()
}

/** True when the text contains Urdu/Arabic script characters. */
export function hasUrduScript(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F]/u.test(text)
}
