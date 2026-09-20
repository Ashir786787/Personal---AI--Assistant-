export const TILE = 16
export const GRID_W = 24
export const GRID_H = 14

export type TileKind = 'wall' | 'floor' | 'desk' | 'whiteboard' | 'server' | 'coffee' | 'plant'

export interface Tile {
  kind: TileKind
}

export type TownMap = Tile[][]

export interface Pt {
  x: number
  y: number
}

export const PLAYER_START: Pt = { x: 12, y: 9 }

export const DESK_XY: readonly Pt[] = [
  { x: 4, y: 6 },
  { x: 9, y: 6 },
  { x: 14, y: 6 },
  { x: 19, y: 6 }
]

export const AGENT_SPOTS: readonly Pt[] = [
  { x: 4, y: 5 },
  { x: 9, y: 5 },
  { x: 14, y: 5 },
  { x: 19, y: 5 }
]

export const COFFEE_SPOT: Pt = { x: 20, y: 9 }

export function buildTownMap(): TownMap {
  return Array.from({ length: GRID_H }, (_, y) =>
    Array.from({ length: GRID_W }, (_, x) => {
      let kind: TileKind = 'floor'
      if (y === 0 || y === GRID_H - 1 || x === 0 || x === GRID_W - 1) {
        kind = 'wall'
      } else if (y === 1 && x >= 6 && x <= 17) {
        kind = 'whiteboard'
      } else if (y === 1 && (x === 2 || x === 21)) {
        kind = 'plant'
      } else if (DESK_XY.some((desk) => desk.x === x && desk.y === y)) {
        kind = 'desk'
      } else if (y === 10 && (x === 2 || x === 3)) {
        kind = 'server'
      } else if (y === 10 && (x === 20 || x === 21)) {
        kind = 'coffee'
      }
      return { kind }
    })
  )
}

export function isWalkable(map: TownMap, x: number, y: number): boolean {
  if (y < 0 || y >= GRID_H || x < 0 || x >= GRID_W) return false
  const row = map[y]
  if (!row) return false
  return row[x]?.kind === 'floor'
}

function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < GRID_W && y >= 0 && y < GRID_H
}

/** 4-direction BFS; returns the walkable tiles from `from` (exclusive) through `to` (inclusive), or null if unreachable. */
export function bfsPath(map: TownMap, from: Pt, to: Pt): Pt[] | null {
  if (from.x === to.x && from.y === to.y) return []
  const startKey = (x: number, y: number): string => `${x},${y}`
  const previous = new Map<string, Pt>()
  const discovered = new Map<string, Pt>()
  const queue: Pt[] = [{ x: to.x, y: to.y }]
  discovered.set(startKey(to.x, to.y), { x: to.x, y: to.y })

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) break
    if (current.x === from.x && current.y === from.y) {
      const path: Pt[] = []
      let cursor = previous.get(startKey(current.x, current.y))
      while (cursor && !(cursor.x === to.x && cursor.y === to.y)) {
        path.push(cursor)
        cursor = previous.get(startKey(cursor.x, cursor.y))
      }
      path.push({ x: to.x, y: to.y })
      return path
    }
    const neighbors: Pt[] = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 }
    ]
    for (const next of neighbors) {
      if (!inBounds(next.x, next.y)) continue
      if (discovered.has(startKey(next.x, next.y))) continue
      if (!isWalkable(map, next.x, next.y)) continue
      discovered.set(startKey(next.x, next.y), next)
      previous.set(startKey(next.x, next.y), current)
      queue.push(next)
    }
  }
  return null
}

/** Move one tile in a direction, respecting walls and furniture. Returns the same `from` when blocked. */
export function movePlayer(map: TownMap, from: Pt, dx: number, dy: number): Pt {
  const target = { x: from.x + dx, y: from.y + dy }
  if (isWalkable(map, target.x, target.y)) return target
  return from
}

/** True when `a` is within `radius` tiles of `b` (E-to-talk range). */
export function canInteract(a: Pt, b: Pt, radius = 1.5): boolean {
  const d = Math.hypot(a.x - b.x, a.y - b.y)
  return d <= radius
}

export function nearestAgent(player: Pt, spots: readonly Pt[], radius = 1.5): number | null {
  let best: number | null = null
  let bestD = radius
  for (let i = 0; i < spots.length; i++) {
    const spot = spots[i]
    if (!spot) continue
    const d = Math.hypot(player.x - spot.x, player.y - spot.y)
    if (d <= bestD) {
      best = i
      bestD = d
    }
  }
  return best
}
