import { describe, expect, it } from 'vitest'
import { isSignificantTranscript } from '../../src/renderer/src/lib/transcriptFilter'
import { isWakePhraseAlone } from '../../src/renderer/src/lib/wake-phrases'

describe('isWakePhraseAlone', () => {
  it('recognizes each wake phrase on its own, case and punctuation insensitive', () => {
    expect(isWakePhraseAlone('hey jarvis')).toBe(true)
    expect(isWakePhraseAlone('  HEY JARVIS. ')).toBe(true)
    expect(isWakePhraseAlone('jarvis')).toBe(true)
    expect(isWakePhraseAlone('hey dude')).toBe(true)
    expect(isWakePhraseAlone('hey ashirs ai')).toBe(true)
    expect(isWakePhraseAlone('hey ashirs')).toBe(true)
  })

  it('keeps utterances that carry a request', () => {
    expect(isWakePhraseAlone('hey jarvis set a reminder')).toBe(false)
    expect(isWakePhraseAlone('hey jarvis what time is it')).toBe(false)
    expect(isWakePhraseAlone('jarvis open youtube')).toBe(false)
    expect(isWakePhraseAlone('what is the weather')).toBe(false)
    expect(isWakePhraseAlone('')).toBe(false)
  })

  it('allows at most one trailing filler word', () => {
    expect(isWakePhraseAlone('hey jarvis huh')).toBe(true)
    expect(isWakePhraseAlone('hey jarvis task')).toBe(false)
  })
})

describe('isSignificantTranscript', () => {
  it('rejects empty and punctuation-only frames', () => {
    expect(isSignificantTranscript('')).toBe(false)
    expect(isSignificantTranscript('   ')).toBe(false)
    expect(isSignificantTranscript('...')).toBe(false)
  })

  it('rejects filled pauses such as the "hmm" echo', () => {
    for (const filler of ['hmm', 'HMM', 'umm', 'uh', 'er', 'huh', 'mhm']) {
      expect(isSignificantTranscript(filler)).toBe(false)
    }
  })

  it('rejects the wake phrase alone after waking', () => {
    expect(isSignificantTranscript('hey jarvis')).toBe(false)
    expect(isSignificantTranscript('hey jarvis huh')).toBe(false)
  })

  it('keeps real questions, commands and short answers', () => {
    for (const text of [
      'no',
      'yes',
      'okay',
      'thanks',
      'what time is it',
      'set a reminder',
      'hey jarvis what time is it'
    ]) {
      expect(isSignificantTranscript(text)).toBe(true)
    }
  })
})
