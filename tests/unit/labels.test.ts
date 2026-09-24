import { describe, expect, it } from 'vitest'
import { measureLabelWidth, planCountryLabels } from '../../src/renderer/src/state/labels'

describe('measureLabelWidth', () => {
  it('scales with name length and font size', () => {
    expect(measureLabelWidth('', 10)).toBe(0)
    expect(measureLabelWidth('Brazil', 10)).toBe(Math.ceil(6 * 10 * 0.62))
    expect(measureLabelWidth('Brazil', 20)).toBeGreaterThan(measureLabelWidth('Brazil', 10))
  })
})

describe('planCountryLabels', () => {
  it('drops invisible (far hemisphere) points', () => {
    const labels = planCountryLabels(
      [
        { name: 'Pakistan', x: 50, y: 50, visible: true },
        { name: 'Brazil', x: 120, y: 120, visible: false }
      ],
      { fontPx: 10, width: 200, height: 200 }
    )
    expect(labels.map((label) => label.name)).toEqual(['Pakistan'])
  })

  it('drops points that fall outside the canvas', () => {
    const labels = planCountryLabels([{ name: 'Canada', x: -20, y: 50, visible: true }], {
      fontPx: 10,
      width: 200,
      height: 200
    })
    expect(labels).toEqual([])
  })

  it('keeps spaced-out labels but drops overlapping ones in order', () => {
    const labels = planCountryLabels(
      [
        { name: 'Pakistan', x: 40, y: 40, visible: true },
        { name: 'India', x: 70, y: 42, visible: true },
        { name: 'Nigeria', x: 150, y: 150, visible: true }
      ],
      { fontPx: 10, width: 200, height: 200 }
    )
    expect(labels.map((label) => label.name)).toEqual(['Pakistan', 'Nigeria'])
  })

  it('returns nothing for an empty input', () => {
    expect(planCountryLabels([], { fontPx: 10, width: 200, height: 200 })).toEqual([])
  })
})
