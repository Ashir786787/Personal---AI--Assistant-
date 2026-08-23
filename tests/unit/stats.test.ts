import { describe, expect, it } from 'vitest'
import { computeCpuPercent } from '../../src/main/ipc/system-handlers'

describe('cpu percent from snapshots', () => {
  it('returns 0 when nothing changed', () => {
    const snap = { idle: 100, total: 200 }
    expect(computeCpuPercent(snap, snap)).toBe(0)
  })

  it('computes busy share between two snapshots', () => {
    const before = { idle: 100, total: 200 }
    const after = { idle: 110, total: 220 }
    // idle gained 10 of 20 total ticks -> 50% busy
    expect(computeCpuPercent(before, after)).toBe(50)
  })

  it('clamps to the 0-100 range and rejects zero deltas', () => {
    expect(computeCpuPercent({ idle: 0, total: 0 }, { idle: 0, total: 0 })).toBe(0)
    expect(computeCpuPercent({ idle: 0, total: 10 }, { idle: -5, total: 20 })).toBe(100)
  })
})
