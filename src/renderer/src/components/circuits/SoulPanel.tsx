import { useEffect, useState } from 'react'
import { SOUL_TRAITS, readTraitValue, traitWord } from './soulTraits'

interface Props {
  onClose: () => void
}

export function SoulPanel({ onClose }: Props): JSX.Element {
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(SOUL_TRAITS.map((trait) => [trait.key, readTraitValue(trait)]))
  )

  useEffect(() => {
    for (const trait of SOUL_TRAITS) {
      localStorage.setItem(trait.storageKey, String(values[trait.key] ?? 50))
    }
  }, [values])

  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-ink-muted">
        Shape how your assistant feels. These dials wire into its core voice in the next phase — for
        now they are saved and waiting.
      </p>
      {SOUL_TRAITS.map((trait) => {
        const val = values[trait.key] ?? 50
        return (
          <div key={trait.key} className="soul-row">
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-muted">
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
            <span className="w-14 text-right font-mono text-[11px] text-ink-muted">
              {traitWord(trait, val) ?? 'balanced'}
            </span>
          </div>
        )
      })}
      <div className="flex justify-end pt-2">
        <button className="btn-cancel" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
