import { describe, expect, it } from 'vitest'
import { matchesWakePhrase, normalizeForWake } from '../../src/renderer/src/lib/wake-phrases'

describe('normalizeForWake', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalizeForWake("  Hey,  Ashir's AI!  ")).toBe('hey ashirs ai')
  })

  it('collapses whitespace', () => {
    expect(normalizeForWake('hey\tdude\n\njarvis')).toBe('hey dude jarvis')
  })
})

describe('matchesWakePhrase', () => {
  it('matches exact phrases', () => {
    expect(matchesWakePhrase('jarvis')).toBe('jarvis')
    expect(matchesWakePhrase('hey dude')).toBe('hey dude')
    expect(matchesWakePhrase('hey ashirs ai')).toBe('hey ashirs ai')
    expect(matchesWakePhrase('hey ashirs')).toBe('hey ashirs')
  })

  it('matches inside a longer partial transcript', () => {
    expect(matchesWakePhrase('well um hey dude what is the weather')).toBe('hey dude')
    expect(matchesWakePhrase('okay so hey ashirs ai open spotify')).toBe('hey ashirs ai')
  })

  it('tolerates small recognition errors', () => {
    expect(matchesWakePhrase('hay dude')).toBe('hey dude')
    expect(matchesWakePhrase('jarvy')).toBe('jarvis')
  })

  it('does not fire on unrelated speech', () => {
    expect(matchesWakePhrase('what time is it in karachi')).toBeNull()
    expect(matchesWakePhrase('hello there general')).toBeNull()
    expect(matchesWakePhrase('')).toBeNull()
  })

  it('respects a strict tolerance of zero', () => {
    expect(matchesWakePhrase('hay dude', { tolerance: 0 })).toBeNull()
    expect(matchesWakePhrase('hey dude', { tolerance: 0 })).toBe('hey dude')
  })

  it('ignores text shorter than the shortest phrase window', () => {
    expect(matchesWakePhrase('hey')).toBeNull()
  })

  it('is punctuation insensitive', () => {
    expect(matchesWakePhrase('Hey! Dude?')).toBe('hey dude')
  })
})
