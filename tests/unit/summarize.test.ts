import { describe, expect, it } from 'vitest'
import { summarizeArgs } from '../../src/main/tools/summarize'

describe('tool argument summaries', () => {
  it('never echoes file content', () => {
    const summary = summarizeArgs({ path: 'C:/Users/secret/notes.txt', content: 'my diary text' })
    expect(summary).not.toContain('my diary text')
    expect(summary).toContain('content=[13 chars omitted]')
  })

  it('omits the content key regardless of value shape', () => {
    expect(summarizeArgs({ content: { a: 'private' } })).toBe('content=[15 chars omitted]')
  })

  it('clips long values instead of flooding the card', () => {
    const summary = summarizeArgs({ note: 'x'.repeat(400) })
    expect(summary.length).toBeLessThan(200)
    expect(summary.endsWith('…')).toBe(true)
  })

  it('keeps the key names so the card stays readable', () => {
    expect(summarizeArgs({ time: '21:00', path: 'Downloads' })).toBe('time=21:00 · path=Downloads')
  })
})
