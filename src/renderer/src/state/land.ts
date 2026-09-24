import type { Gazetteer } from '@shared/feed'
import landJson from '../assets/maps/land.json'
import gazetteerJson from '../assets/maps/gazetteer.json'

export type LonLat = readonly [number, number]
export type LandRing = ReadonlyArray<LonLat>

export interface LandData {
  src: string
  rings: LandRing[]
}

const rawLand = landJson as unknown as LandData

export const LAND_RINGS: readonly LandRing[] = rawLand.rings.map((ring) =>
  ring.map((pair) => [pair[0], pair[1]] as const)
)
export const LAND_SOURCE = rawLand.src
export const GAZETTEER = gazetteerJson as Gazetteer
