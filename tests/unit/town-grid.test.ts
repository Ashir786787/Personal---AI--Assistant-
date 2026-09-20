import { describe, expect, it } from 'vitest'
import {
  AGENT_SPOTS,
  DESK_XY,
  GRID_H,
  GRID_W,
  PLAYER_START,
  bfsPath,
  buildTownMap,
  canInteract,
  isWalkable,
  movePlayer,
  nearestAgent
} from '../../src/renderer/src/state/townGrid'

describe('town grid (spec 5.2)', () => {
  const map = buildTownMap()

  it('is 24x14 tiles', () => {
    expect(GRID_W).toBe(24)
    expect(GRID_H).toBe(14)
    expect(map.length).toBe(14)
    for (const row of map) expect(row.length).toBe(24)
  })

  it('surrounds the town with walls', () => {
    for (let x = 0; x < GRID_W; x++) {
      expect(isWalkable(map, x, 0)).toBe(false)
      expect(isWalkable(map, x, GRID_H - 1)).toBe(false)
    }
    for (let y = 0; y < GRID_H; y++) {
      expect(isWalkable(map, 0, y)).toBe(false)
      expect(isWalkable(map, GRID_W - 1, y)).toBe(false)
    }
  })

  it('marks every desk and agent spot correctly', () => {
    for (const desk of DESK_XY) {
      expect(map[desk.y]?.[desk.x]?.kind).toBe('desk')
    }
    for (const spot of AGENT_SPOTS) expect(isWalkable(map, spot.x, spot.y)).toBe(true)
  })

  it('BFS walks between two agent desks around obstacles', () => {
    const path = bfsPath(map, AGENT_SPOTS[0]!, AGENT_SPOTS[3]!)
    expect(path).not.toBeNull()
    if (path) {
      expect(path.length).toBeGreaterThan(1)
      expect(path[path.length - 1]).toEqual(AGENT_SPOTS[3])
      for (const step of path) expect(isWalkable(map, step.x, step.y)).toBe(true)
    }
  })

  it('BFS returns empty for same tile and null outside the map', () => {
    expect(bfsPath(map, PLAYER_START, PLAYER_START)).toEqual([])
    expect(bfsPath(map, PLAYER_START, { x: -1, y: -1 })).toBeNull()
    expect(bfsPath(map, PLAYER_START, { x: 0, y: 0 })).toBeNull()
  })

  it('movePlayer respects walls and furniture but allows floor movement', () => {
    const atWall = movePlayer(map, { x: 1, y: 1 }, -1, 0)
    expect(atWall).toEqual({ x: 1, y: 1 })

    const aboveDesk = movePlayer(map, { x: 3, y: 6 }, 1, 0)
    expect(aboveDesk).toEqual({ x: 3, y: 6 })

    const openMove = movePlayer(map, PLAYER_START, 1, 0)
    expect(openMove).toEqual({ x: PLAYER_START.x + 1, y: PLAYER_START.y })
  })

  it('canInteract returns true within 1.5 tiles and false beyond', () => {
    expect(canInteract({ x: 4, y: 5 }, { x: 4, y: 5 })).toBe(true)
    expect(canInteract({ x: 4, y: 5 }, { x: 4, y: 6 })).toBe(true)
    expect(canInteract({ x: 4, y: 5 }, { x: 4, y: 8 })).toBe(false)
    expect(canInteract({ x: 1, y: 12 }, { x: 4, y: 5 })).toBe(false)
  })

  it('nearestAgent picks the closest person within range only', () => {
    expect(nearestAgent({ x: 3, y: 5 }, AGENT_SPOTS)).toBe(0)
    expect(nearestAgent({ x: 20, y: 5 }, AGENT_SPOTS)).toBe(3)
    expect(nearestAgent({ x: 1, y: 5 }, AGENT_SPOTS)).toBeNull()
    expect(nearestAgent({ x: 10, y: 12 }, AGENT_SPOTS, 1.5)).toBeNull()
  })
})
