import { describe, expect, it } from 'vitest'
import {
  appendSample,
  sparkPoints,
  SPARK_MAX_SAMPLES
} from '../../src/renderer/src/state/systemHistory'

describe('system sample history (spec 5.4)', () => {
  it('appends new samples in order and caps at the window size', () => {
    const grown = appendSample([], 42)
    expect(grown).toEqual([42])
    const full = appendSample([1, 2, 3], 4, 3)
    expect(full).toEqual([2, 3, 4])
    expect(full.length).toBe(3)
  })

  it('keeps exactly SPARK_MAX_SAMPLES and drops the oldest', () => {
    const initial = Array.from({ length: SPARK_MAX_SAMPLES }, (_, i) => i)
    const next = appendSample(initial, 99)
    expect(next.length).toBe(SPARK_MAX_SAMPLES)
    expect(next[next.length - 1]).toBe(99)
    expect(next[0]).toBe(1)
  })

  it('does not mutate the caller buffer', () => {
    const base = [10, 20, 30, 40]
    const result = appendSample(base, 50, 3)
    expect(base).toEqual([10, 20, 30, 40])
    expect(result).toEqual([30, 40, 50])
  })

  it('returns empty geometry for fewer than two samples', () => {
    expect(sparkPoints([], 100, 32)).toBe('')
    expect(sparkPoints([7], 100, 32)).toBe('')
  })

  it('scales min to the bottom and max to the top with padding', () => {
    expect(sparkPoints([0, 100], 100, 32)).toBe('2,28 98,4')
    expect(sparkPoints([0, 50, 100], 100, 32)).toBe('2,28 50,16 98,4')
  })

  it('renders a flat center line when all samples are equal', () => {
    expect(sparkPoints([50, 50, 50], 100, 32)).toBe('2,16 50,16 98,16')
  })
})
