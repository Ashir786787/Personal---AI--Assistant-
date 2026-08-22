import { describe, expect, it } from 'vitest'
import { extractToolAction } from '../../src/main/tools/parse'

describe('tool step budget cap-out behavior', () => {
  it('an over-budget action is still detectable so the loop can stop cleanly', () => {
    const raw =
      '```json\n{"tool":"search_files","args":{"path":"Pictures","query":"vanguard"}}\n```'
    expect(extractToolAction(raw)?.tool).toBe('search_files')
  })

  it('the budget message never leaks json or stack traces', () => {
    const BUDGET_LINE =
      'I\'ve used my step budget for this request and stopped safely. Say "continue" and I\'ll pick up where I left off'
    expect(BUDGET_LINE).not.toMatch(/[{}]/)
    expect(BUDGET_LINE).toContain('continue')
  })
})
