import { describe, expect, it } from 'vitest'
import { hasUrduScript, speechText } from '../../src/renderer/src/lib/speechText'

describe('speechText', () => {
  it('strips markdown so replies read naturally', () => {
    expect(
      speechText(
        '# Heading\n\nSome **bold** and *italic* with `inline code` and [a link](https://x)'
      )
    ).toBe('Heading Some bold and italic with inline code and a link')
  })

  it('drops fenced code blocks instead of reading them', () => {
    expect(speechText('Result:\n```js\nconst x = 1\n```\nDone')).toBe('Result: Done')
  })

  it('strips list markers', () => {
    expect(speechText('- one\n- two\n1. three')).toBe('one two three')
  })

  it('collapses whitespace', () => {
    expect(speechText('first\n\n\n   second   third')).toBe('first second third')
  })

  it('returns short text unchanged', () => {
    const short = 'hello world'
    expect(speechText(short, 20)).toBe('hello world')
  })

  it('caps length at a whole-word boundary', () => {
    const long = 'one two three four five six'.repeat(10)
    const out = speechText(long, 6)
    expect(out.length).toBeLessThanOrEqual(6)
    expect(out).toBe('one')
  })

  it('trims trailing punctuation at the cut point', () => {
    const out = speechText('aaa bbb ccc, ddd eee ' + 'word '.repeat(40), 9)
    expect(out.endsWith(',')).toBe(false)
    expect(out.endsWith('.')).toBe(false)
  })

  it('returns empty string for empty input', () => {
    expect(speechText('')).toBe('')
  })
})

describe('hasUrduScript', () => {
  it('detects Urdu script', () => {
    expect(hasUrduScript('سلام')).toBe(true)
    expect(hasUrduScript('اردو میں جواب دیں')).toBe(true)
  })

  it('returns false for English and mixed latin', () => {
    expect(hasUrduScript('hello world')).toBe(false)
    expect(hasUrduScript('12:30 today')).toBe(false)
  })

  it('detects script anywhere in the string', () => {
    expect(hasUrduScript('Here is اردو text')).toBe(true)
  })
})
