export interface LabelProjection {
  name: string
  x: number
  y: number
  visible: boolean
}

export interface CountryLabel {
  name: string
  x: number
  y: number
}

export interface LabelPlanOptions {
  fontPx: number
  width: number
  height: number
  margin?: number
  padding?: number
}

// Character-width estimate for the monospace label font. Kept in one place so
// the classifier stays pure and unit-testable without a canvas.
export function measureLabelWidth(name: string, fontPx: number): number {
  return Math.ceil(name.length * fontPx * 0.62)
}

function labelRect(
  label: CountryLabel,
  fontPx: number
): { x: number; y: number; w: number; h: number } {
  const w = measureLabelWidth(label.name, fontPx)
  const h = Math.round(fontPx * 1.25)
  return { x: label.x - w / 2, y: label.y - h / 2, w, h }
}

function intersects(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
  padding: number
): boolean {
  return (
    a.x < b.x + b.w + padding && b.x < a.x + a.w + padding && a.y < b.y + b.h && b.y < a.y + a.h
  )
}

/**
 * Greedy label selection: keeps candidates that are inside the canvas and do
 * not overlap a previously kept label. Iterating in order means early entries
 * win ties — callers pass the gazetteer order, which is A–Z by country name.
 */
export function planCountryLabels(
  candidates: readonly LabelProjection[],
  options: LabelPlanOptions
): CountryLabel[] {
  const { fontPx, width, height, margin = 6, padding = 7 } = options
  const chosen: CountryLabel[] = []
  for (const candidate of candidates) {
    if (!candidate.visible) continue
    const rect = labelRect({ name: candidate.name, x: candidate.x, y: candidate.y }, fontPx)
    if (
      rect.x < margin ||
      rect.y < margin ||
      rect.x + rect.w > width - margin ||
      rect.y + rect.h > height - margin
    ) {
      continue
    }
    if (chosen.some((label) => intersects(rect, labelRect(label, fontPx), padding))) continue
    chosen.push({ name: candidate.name, x: candidate.x, y: candidate.y })
  }
  return chosen
}
