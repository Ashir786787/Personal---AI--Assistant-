import { describe, expect, it } from 'vitest'
import type { Gazetteer } from '../../src/shared/feed'
import { matchHotspots } from '../../src/shared/feed'
import gazetteerJson from '../../src/renderer/src/assets/maps/gazetteer.json'

const GAZETTEER = gazetteerJson as Gazetteer

describe('headline hotspot matching (spec 5.3)', () => {
  it('places a hotspot when a real country name appears in a headline', () => {
    const hotspots = matchHotspots(
      [{ title: 'Pakistan floods displace thousands, officials say', text: '' }],
      GAZETTEER
    )
    const pakistan = hotspots.find((hotspot) => hotspot.name === 'Pakistan')
    expect(pakistan).toBeDefined()
    expect(pakistan!.count).toBe(1)
    expect(pakistan!.lat).toBeGreaterThan(20)
    expect(pakistan!.lat).toBeLessThan(40)
    expect(pakistan!.lon).toBeGreaterThan(60)
    expect(pakistan!.lon).toBeLessThan(75)
  })

  it('matches alias forms like US and UK without false positives', () => {
    const hotspots = matchHotspots(
      [{ title: 'US talks stall while UK welcomes peace deal', text: '' }],
      GAZETTEER
    )
    expect(hotspots.some((hotspot) => hotspot.name === 'United States of America')).toBe(true)
    expect(hotspots.some((hotspot) => hotspot.name === 'United Kingdom')).toBe(true)
    const noHit = matchHotspots(
      [{ title: 'focus on radius, usb and bus tickets', text: '' }],
      GAZETTEER
    )
    expect(noHit.some((hotspot) => hotspot.name === 'United States of America')).toBe(false)
  })

  it('dedupes a country mentioned across several headlines', () => {
    const hotspots = matchHotspots(
      [
        { title: 'Ukraine grain exports recover', text: '' },
        { title: 'Ukraine looks to winter offensives', text: '' },
        { title: 'Markets eye Ukraine harvest', text: '' }
      ],
      GAZETTEER
    )
    const ukraine = hotspots.filter((hotspot) => hotspot.name === 'Ukraine')
    expect(ukraine).toHaveLength(1)
    expect(ukraine[0]!.count).toBe(3)
  })

  it('stays silent when no country is named', () => {
    const hotspots = matchHotspots(
      [{ title: 'Global markets rise after tech earnings', text: '' }],
      GAZETTEER
    )
    expect(hotspots).toEqual([])
  })
})
