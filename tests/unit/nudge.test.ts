import { describe, expect, it } from 'vitest'
import { looksFileRelated, shouldNudge } from '../../src/main/tools/nudge'

describe('file-intent detection', () => {
  it('matches common file and folder questions', () => {
    expect(looksFileRelated('how many files are in my downloads?')).toBe(true)
    expect(looksFileRelated('organize my downloads folder')).toBe(true)
    expect(looksFileRelated('clean up my documents')).toBe(true)
    expect(looksFileRelated('list all my files')).toBe(true)
  })

  it('ignores unrelated chat', () => {
    expect(looksFileRelated('hello there')).toBe(false)
    expect(looksFileRelated('what is the capital of france?')).toBe(false)
    expect(looksFileRelated('tell me a joke')).toBe(false)
  })
})

describe('nudge decision', () => {
  it('nudges prose-only replies to clear file questions', () => {
    expect(
      shouldNudge({
        hadAction: false,
        alreadyNudged: false,
        userText: 'list all files in downloads',
        replyText: 'Sure, here is what you have...'
      })
    ).toBe(true)
  })

  it('never nudges when an action was emitted or already nudged once', () => {
    const base = { alreadyNudged: false, userText: 'list all files in downloads' }
    expect(shouldNudge({ ...base, hadAction: true, replyText: '{"tool":"list_folder"}' })).toBe(
      false
    )
    expect(
      shouldNudge({ ...base, alreadyNudged: true, hadAction: false, replyText: 'prose' })
    ).toBe(false)
  })

  it('never nudges non-file conversations', () => {
    expect(
      shouldNudge({
        hadAction: false,
        alreadyNudged: false,
        userText: 'tell me about black holes',
        replyText: 'A black hole is...'
      })
    ).toBe(false)
  })

  it('skips replies that already cite tool results', () => {
    expect(
      shouldNudge({
        hadAction: false,
        alreadyNudged: false,
        userText: 'how many files?',
        replyText: 'Based on the TOOL_RESULT above, 27 items'
      })
    ).toBe(false)
  })
})
