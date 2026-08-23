import { useEffect, useState } from 'react'
import type { MemorySummary } from '@shared/ipc'

interface Props {
  onClose: () => void
}

const SLOTS = [
  { title: 'Your name', value: 'Ashir', note: 'from our first hello' },
  { title: 'Preferences', value: 'Learning…', note: 'I pick these up as we talk' },
  { title: 'Projects', value: 'ASHIR’s AI', note: 'the assistant we are building together' }
]

export function MemoryPanel({ onClose }: Props): JSX.Element {
  const [summary, setSummary] = useState<MemorySummary | null>(null)

  useEffect(() => {
    void window.ashirs.memorySummary().then(setSummary)
  }, [])

  return (
    <div className="confirm-backdrop" onClick={onClose}>
      <div
        className="confirm-card"
        role="dialog"
        aria-modal="true"
        aria-label="Memory circuit"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-header">
          <span className="circuit-glyph-lg text-accent">❖</span>
          <h2>Memory Circuit</h2>
          <p className="confirm-sub">
            Everything here lives on this machine only. Deeper memory — facts, habits, routines —
            comes online in the next phase.
          </p>
        </div>

        <div className="settings-body">
          <div className="memory-stat-row">
            <div>
              <strong>{summary ? summary.messageCount : '—'}</strong>
              <span>messages remembered</span>
            </div>
            <div>
              <strong>
                {summary?.oldestAt ? new Date(summary.oldestAt).toLocaleDateString() : '—'}
              </strong>
              <span>first contact</span>
            </div>
          </div>

          {SLOTS.map((slot) => (
            <div key={slot.title} className="memory-card">
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted">
                {slot.title}
              </span>
              <p className="text-sm font-medium text-ink">{slot.value}</p>
              <p className="text-xs text-ink-muted">{slot.note}</p>
            </div>
          ))}
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
