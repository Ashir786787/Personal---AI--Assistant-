import { isWakePhraseAlone, normalizeForWake, WAKE_FILLER_WORDS } from './wake-phrases'

/**
 * Voice recognition sometimes finalizes an empty frame or a filled pause right
 * after the wake word (the mic opens while the user is not talking yet). Sending
 * that to the model produces the "Hmm?" / "Yes, boss?" style replies. Only
 * empty, filler- or wake-phrase-only utterances are treated as insignificant —
 * a real instruction or a yes/no answer is always kept.
 */
export function isSignificantTranscript(text: string): boolean {
  const normalized = normalizeForWake(text)
  if (normalized.length === 0) return false
  if (WAKE_FILLER_WORDS.has(normalized)) return false
  if (isWakePhraseAlone(normalized)) return false
  return true
}
