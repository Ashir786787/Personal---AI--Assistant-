export interface SoulTrait {
  key: string
  label: string
  low: string
  high: string
  storageKey: string
}

export const SOUL_TRAITS: SoulTrait[] = [
  {
    key: 'formality',
    label: 'Formality',
    low: 'Casual',
    high: 'Formal',
    storageKey: 'ashirs.soul.formality'
  },
  {
    key: 'humor',
    label: 'Humor',
    low: 'Serious',
    high: 'Playful',
    storageKey: 'ashirs.soul.humor'
  },
  {
    key: 'verbosity',
    label: 'Verbosity',
    low: 'Brief',
    high: 'Detailed',
    storageKey: 'ashirs.soul.verbosity'
  },
  { key: 'pace', label: 'Speech pace', low: 'Calm', high: 'Brisk', storageKey: 'ashirs.soul.pace' }
]

export function readTraitValue(trait: SoulTrait): number {
  const raw = Number(localStorage.getItem(trait.storageKey))
  return Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 50
}

export function traitWord(trait: SoulTrait, value: number): string | null {
  if (value < 34) return trait.low
  if (value > 66) return trait.high
  return null
}

export function readSoulSummary(): string {
  const words = SOUL_TRAITS.map((trait) => traitWord(trait, readTraitValue(trait)) ?? null).filter(
    (word): word is string => word !== null
  )
  return words.length > 0 ? words.join(' · ') : 'Balanced'
}
