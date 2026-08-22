import { describe, expect, it } from 'vitest'
import { extractToolAction } from '../../src/main/tools/parse'

describe('extractToolAction parsing edge cases', () => {
  it('parses bare json', () => {
    expect(extractToolAction('{"tool":"list_folder","args":{"path":"Downloads"}}')).toEqual({
      tool: 'list_folder',
      args: { path: 'Downloads' }
    })
  })

  it('parses fenced json with language tag', () => {
    const text = '```json\n{"tool":"folder_summary","args":{"path":"Documents"}}\n```'
    expect(extractToolAction(text)?.tool).toBe('folder_summary')
  })

  it('parses json wrapped in prose before and after', () => {
    const text =
      'I will check that for you.\n\n{"tool":"list_folder","args":{"path":{"nested":"Downloads"}}}\n\nOne moment please.'
    const action = extractToolAction(text)
    expect(action?.tool).toBe('list_folder')
    expect(action?.args).toEqual({ path: { nested: 'Downloads' } })
  })

  it('handles braces nested inside string args', () => {
    const text = '{"tool":"list_folder","args":{"path":"weird}{name"}}'
    expect(extractToolAction(text)?.args).toEqual({ path: 'weird}{name' })
  })

  it('returns null for plain prose and malformed json', () => {
    expect(extractToolAction('Just chatting about the weather')).toBeNull()
    expect(extractToolAction('{"tool": "list_folder", broken')).toBeNull()
  })

  it('returns null when json has no tool field', () => {
    expect(extractToolAction('{"answer": 42}')).toBeNull()
  })
})
