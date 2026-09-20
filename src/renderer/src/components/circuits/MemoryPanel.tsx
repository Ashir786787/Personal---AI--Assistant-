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
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-ink-muted">
        Everything here lives on this machine only. Deeper memory — facts, habits, routines — comes
        online in the next phase.
      </p>

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
          <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-muted">
            {slot.title}
          </span>
          <p className="text-sm font-medium text-ink">{slot.value}</p>
          <p className="text-xs text-ink-muted">{slot.note}</p>
        </div>
      ))}

      <div className="flex justify-end pt-2">
        <button className="btn-cancel" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
