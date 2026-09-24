export interface Pt {
  x: number
  y: number
}

export interface Rotation {
  lon: number
  lat: number
}

export interface Projected extends Pt {
  visible: boolean
}

const DEG = Math.PI / 180

export function toRad(degrees: number): number {
  return degrees * DEG
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Subsolar point (where the sun is directly overhead) at a given instant.
 * Declination from Spencer's low-precision solar position series; longitude
 * from the UTC hour angle. Both land far from any network call.
 */
export function subsolarPoint(date: Date): { lat: number; lon: number } {
  const now = date.getTime()
  const start = Date.UTC(date.getUTCFullYear(), 0, 1)
  const secondsOfYear = (now - start) / 1000
  const gamma = (2 * Math.PI * secondsOfYear) / 31_556_952
  const declination =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma)
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
  return { lat: declination / DEG, lon: -15 * (hours - 12) }
}

/** Central angle in degrees between two points on the sphere. */
export function centralAngle(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const sin1 = Math.sin(toRad(lat1))
  const cos1 = Math.cos(toRad(lat1))
  const sin2 = Math.sin(toRad(lat2))
  const cos2 = Math.cos(toRad(lat2))
  const cosDelta = Math.cos(toRad(lon1 - lon2))
  const cosc = sin1 * sin2 + cos1 * cos2 * cosDelta
  return Math.acos(clamp(cosc, -1, 1)) / DEG
}

export const TERMINATOR_FADE_DEG = 6

export function nightFactor(lat: number, lon: number, sun: { lat: number; lon: number }): number {
  const ang = centralAngle(lat, lon, sun.lat, sun.lon)
  if (ang >= 90 + TERMINATOR_FADE_DEG) return 1
  if (ang <= 90 - TERMINATOR_FADE_DEG) return 0
  return (ang - (90 - TERMINATOR_FADE_DEG)) / (2 * TERMINATOR_FADE_DEG)
}

export function isNight(lat: number, lon: number, sun: { lat: number; lon: number }): boolean {
  return centralAngle(lat, lon, sun.lat, sun.lon) > 90
}

export function orthographicProject(
  lonDeg: number,
  latDeg: number,
  rotation: Rotation,
  externalRad = 0
): Projected {
  const phi = toRad(latDeg)
  const phi0 = toRad(rotation.lat)
  const delta = toRad(lonDeg - rotation.lon)
  const cosC = Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(delta)
  const cosPhi = Math.cos(phi)
  const sinPhi = Math.sin(phi)
  const sinPhi0 = Math.sin(phi0)
  const cosPhi0 = Math.cos(phi0)
  const visible = cosC > externalRad
  return {
    x: cosPhi * Math.sin(delta),
    y: cosPhi0 * sinPhi - sinPhi0 * cosPhi * Math.cos(delta),
    visible
  }
}

export function equirectangularProject(lonDeg: number, latDeg: number): Pt {
  return {
    x: (lonDeg + 180) / 360,
    y: (90 - latDeg) / 180
  }
}

export function clampZoom(scale: number, min = 1, max = 8): number {
  return clamp(scale, min, max)
}

export function ringCentroid(ring: ReadonlyArray<readonly [number, number]>): {
  lat: number
  lon: number
} {
  let lat = 0
  let lon = 0
  for (const point of ring) {
    lat += point[1]
    lon += point[0]
  }
  return { lat: lat / ring.length, lon: lon / ring.length }
}
