import { useEffect, useState } from 'react'

interface Props {
  onClose: () => void
}

interface SoulTrait {
  key: string
  label: string
  low: string
  high: string
  storageKey: string
}

const TRAITS: SoulTrait[] = [
  {
    key: 'formality',
    label: 'Formality',
    low: 'casual',
    high: 'formal',
    storageKey: 'ashirs.soul.formality'
  },
  {
    key: 'humor',
    label: 'Humor',
    low: 'serious',
    high: 'playful',
    storageKey: 'ashirs.soul.humor'
  },
  {
    key: 'verbosity',
    label: 'Verbosity',
    low: 'brief',
    high: 'detailed',
    storageKey: 'ashirs.soul.verbosity'
  },
  { key: 'pace', label: 'Speech pace', low: 'calm', high: 'brisk', storageKey: 'ashirs.soul.pace' }
]

function readTrait(trait: SoulTrait): number {
  const raw = Number(localStorage.getItem(trait.storageKey))
  return Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 50
}

export function SoulPanel({ onClose }: Props): JSX.Element {
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(TRAITS.map((trait) => [trait.key, readTrait(trait)]))
  )

  useEffect(() => {
    for (const trait of TRAITS) {
      localStorage.setItem(trait.storageKey, String(values[trait.key] ?? 50))
    }
  }, [values])

  return (
    <div className="confirm-backdrop" onClick={onClose}>
      <div
        className="confirm-card"
        role="dialog"
        aria-modal="true"
        aria-label="Soul circuit"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-header">
          <span className="circuit-glyph-lg text-accent">✷</span>
          <h2>Soul Circuit</h2>
          <p className="confirm-sub">
            Shape how your assistant feels. These dials wire into its core voice in the next phase —
            for now they are saved and waiting.
          </p>
        </div>

        <div className="settings-body">
          {TRAITS.map((trait) => {
            const val = values[trait.key] ?? 50
            return (
              <div key={trait.key} className="soul-row">
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted">
                  {trait.label}
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={val}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [trait.key]: Number(e.target.value) }))
                  }
                  className="soul-slider"
                  aria-label={trait.label}
                />
                <span className="w-14 text-right font-mono text-[10px] text-ink-muted">
                  {val < 34 ? trait.low : val > 66 ? trait.high : 'balanced'}
                </span>
              </div>
            )
          })}
        </div>

        <div className="confirm-actions">
          <button className="btn-cancel" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
