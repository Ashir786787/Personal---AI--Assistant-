import { describe, expect, it } from 'vitest'
import {
  clampZoom,
  equirectangularProject,
  isNight,
  nightFactor,
  orthographicProject,
  ringCentroid,
  subsolarPoint
} from '../../src/renderer/src/state/geo'

describe('geo projection math (spec 5.3)', () => {
  it('places the subsolar point near the equator at equinox', () => {
    const noonEquinox = subsolarPoint(new Date(Date.UTC(2026, 2, 20, 12, 0, 0)))
    expect(Math.abs(noonEquinox.lat)).toBeLessThan(1)
    expect(Math.abs(noonEquinox.lon)).toBeLessThan(2)
  })

  it('respects the seasonal declination extrema', () => {
    const june = subsolarPoint(new Date(Date.UTC(2026, 5, 21, 12, 0, 0)))
    const dec = subsolarPoint(new Date(Date.UTC(2026, 11, 21, 12, 0, 0)))
    expect(june.lat).toBeGreaterThan(22.4)
    expect(dec.lat).toBeLessThan(-22.4)
  })

  it('shades night on the far side of the globe', () => {
    const sun = { lat: 0, lon: 0 }
    expect(isNight(0, 0, sun)).toBe(false)
    expect(isNight(0, 100, sun)).toBe(true)
    expect(isNight(89, 0, sun)).toBe(false)
  })

  it('fades nightFactor across a soft terminator band', () => {
    const sun = { lat: 0, lon: 0 }
    expect(nightFactor(0, 0, sun)).toBe(0)
    expect(nightFactor(0, 179, sun)).toBe(1)
    const low = nightFactor(0, 85, sun)
    const high = nightFactor(0, 95, sun)
    expect(low).toBeLessThan(high)
    expect(low).toBeGreaterThan(0)
    expect(high).toBeLessThan(1)
  })

  it('projects the front hemisphere and culls the back one', () => {
    const rot = { lon: 0, lat: 0 }
    const center = orthographicProject(0, 0, rot)
    expect(center.visible).toBe(true)
    expect(center.x).toBeCloseTo(0, 6)
    expect(center.y).toBeCloseTo(0, 6)
    const limb = orthographicProject(0, 90, rot)
    expect(limb.visible).toBe(true)
    expect(limb.y).toBeCloseTo(1, 6)
    const far = orthographicProject(180, 0, rot)
    expect(far.visible).toBe(false)
    const shifted = orthographicProject(45, 0, { lon: 45, lat: 0 })
    expect(shifted.visible).toBe(true)
    expect(shifted.x).toBeCloseTo(0, 6)
  })

  it('maps equirectangular corners to the unit square', () => {
    expect(equirectangularProject(-180, 90)).toEqual({ x: 0, y: 0 })
    expect(equirectangularProject(180, -90).x).toBeCloseTo(1, 6)
    expect(equirectangularProject(180, -90).y).toBeCloseTo(1, 6)
    expect(equirectangularProject(0, 0).x).toBeCloseTo(0.5, 6)
    expect(equirectangularProject(0, 0).y).toBeCloseTo(0.5, 6)
  })

  it('clamps zoom to sane bounds', () => {
    expect(clampZoom(0.3)).toBe(1)
    expect(clampZoom(99)).toBe(8)
    expect(clampZoom(3)).toBe(3)
  })

  it('computes the mean of a ring', () => {
    const centroid = ringCentroid([
      [0, 0],
      [0, 2],
      [2, 2],
      [2, 0]
    ])
    expect(centroid.lat).toBe(1)
    expect(centroid.lon).toBe(1)
  })
})
