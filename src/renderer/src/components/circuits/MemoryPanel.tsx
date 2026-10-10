import { useEffect, useState } from 'react'
import type { MemorySummary } from '@shared/ipc'

interface Props {
  onClose: () => void
}

const SLOTS = [
  { title: 'Your name', value: 'Ashir', note: 'from our first hello' },
  { title: 'Preferences', value: 'Not learned yet', note: 'I keep the whole transcript instead' },
  { title: 'Projects', value: "ASHIR's AI", note: 'the assistant we are building together' }
]

export function MemoryPanel({ onClose }: Props): JSX.Element {
  const [summary, setSummary] = useState<MemorySummary | null>(null)

  useEffect(() => {
    void window.ashirs.memorySummary().then(setSummary)
  }, [])

  const total = summary === null ? 0 : summary.messageCount + summary.agentMessageCount

  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-ink-muted">
        The transcripts live on this machine only, and the chat you see is sent to the AI provider
        you chose. Deeper memory — facts, habits, routines — comes online in the next phase.
      </p>

      <div className="memory-stat-row">
        <div>
          <strong>{summary ? total : '—'}</strong>
          <span>messages remembered</span>
        </div>
        <div>
          <strong>{summary ? summary.storeCount : '—'}</strong>
          <span>encrypted stores</span>
        </div>
      </div>

      {summary !== null && summary.agentMessageCount > 0 && (
        <p className="font-mono text-[11px] text-ink-muted">
          {summary.messageCount} in chat · {summary.agentMessageCount} in the town agents
        </p>
      )}

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
