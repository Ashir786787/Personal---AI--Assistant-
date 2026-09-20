import { describe, expect, it } from 'vitest'
import { resolveReducedMotion } from '../../src/renderer/src/hooks/useReducedMotion'

describe('resolveReducedMotion', () => {
  it('honors an explicit "reduced" choice regardless of the system', () => {
    expect(resolveReducedMotion('reduced', false)).toBe(true)
    expect(resolveReducedMotion('reduced', true)).toBe(true)
  })

  it('"auto" follows the system preference', () => {
    expect(resolveReducedMotion('auto', true)).toBe(true)
    expect(resolveReducedMotion('auto', false)).toBe(false)
  })

  it('never returns reduced for "auto" when the system is not in reduced motion', () => {
    expect(resolveReducedMotion('auto', false)).toBe(false)
  })
})
