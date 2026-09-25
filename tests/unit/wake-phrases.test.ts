import { describe, expect, it } from 'vitest'
import {
  matchesWakePhrase,
  normalizeForWake,
  stripWakePrefix
} from '../../src/renderer/src/lib/wake-phrases'

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
    expect(matchesWakePhrase('hey jarvis')).toBe('hey jarvis')
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

describe('stripWakePrefix', () => {
  it('removes a leading wake phrase', () => {
    expect(stripWakePrefix('hey jarvis set a reminder')).toBe('set a reminder')
    expect(stripWakePrefix('hey dude whats the time')).toBe('whats the time')
  })

  it('removes the phrase even when words precede it', () => {
    expect(stripWakePrefix('okay so hey ashirs ai open spotify')).toBe('okay so open spotify')
  })

  it('returns an empty string for a bare wake phrase', () => {
    expect(stripWakePrefix('hey jarvis')).toBe('')
    expect(stripWakePrefix('jarvis huh')).toBe('')
  })

  it('leaves unrelated text untouched', () => {
    expect(stripWakePrefix('what time is it in karachi')).toBe('what time is it in karachi')
  })

  it('tolerates small recognition errors while stripping', () => {
    expect(stripWakePrefix('hay jarvis turn up the volume')).toBe('turn up the volume')
  })
})
