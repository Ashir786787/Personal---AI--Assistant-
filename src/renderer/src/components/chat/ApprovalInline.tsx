import { useEffect, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { ActionProposal } from '@shared/ipc'

const FIRST_N_ITEMS = 10

interface ApprovalInlineProps {
  proposal: ActionProposal
  busy: boolean
  queued: number
  onDecide: (approved: boolean) => void
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(total / 60)
  return `${minutes}:${String(total % 60).padStart(2, '0')}`
}

export function ApprovalInline({ proposal, busy, queued, onDecide }: ApprovalInlineProps) {
  const [leftMs, setLeftMs] = useState(() => proposal.expiresAt - Date.now())

  useEffect(() => {
    setLeftMs(proposal.expiresAt - Date.now())
    const tick = window.setInterval(() => {
      setLeftMs(proposal.expiresAt - Date.now())
    }, 1000)
    return () => window.clearInterval(tick)
  }, [proposal.id, proposal.expiresAt])

  // Enter approves and Esc denies, but only while this card itself holds focus. The
  // buttons sit inside the card, so a key pressed on a button must be left alone —
  // otherwise Enter on Deny would bubble up here and approve instead of denying.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' && !busy) {
      event.preventDefault()
      onDecide(true)
      return
    }
    if (event.key === 'Escape' && !busy) {
      event.preventDefault()
      onDecide(false)
    }
  }

  const shown = proposal.detailLines.slice(0, FIRST_N_ITEMS)
  const hidden = proposal.detailLines.length - shown.length

  return (
    <div
      role="group"
      tabIndex={0}
      aria-label={`Approval needed: ${proposal.title}`}
      onKeyDown={onKeyDown}
      className="w-full max-w-[86%] rounded-xl border border-accent-dim/50 bg-panel-raised/70 px-4 py-3 focus:border-accent focus:outline-none"
    >
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="text-accent-dim">
          🛡
        </span>
        <h3 className="min-w-0 flex-1 text-sm font-semibold text-ink">{proposal.title}</h3>
        <span className="shrink-0 font-mono text-[11px] text-ink-muted">
          {formatCountdown(leftMs)}
        </span>
      </div>

      <p className="mt-1 text-[13px] text-ink-muted">
        {proposal.totalMoves} change{proposal.totalMoves === 1 ? '' : 's'} · nothing happens until
        you approve
      </p>

      <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-[13px] text-ink">
        {shown.map((line, index) => (
          <li key={`${index}-${line}`} className="font-mono text-[12px] leading-relaxed">
            {line}
          </li>
        ))}
        {hidden > 0 && (
          <li className="font-mono text-[12px] text-ink-muted">
            …and {hidden} more line{hidden === 1 ? '' : 's'}
          </li>
        )}
      </ul>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          className="btn-approve btn-small"
          disabled={busy}
          onClick={() => onDecide(true)}
        >
          {busy ? 'Working…' : 'Approve'}
        </button>
        <button
          type="button"
          className="btn-cancel btn-small"
          disabled={busy}
          onClick={() => onDecide(false)}
        >
          Deny
        </button>
        {queued > 0 && (
          <span className="ml-auto font-mono text-[11px] text-ink-muted">
            {queued} more waiting
          </span>
        )}
      </div>
      <p className="mt-2 font-mono text-[11px] text-ink-muted/70">
        Focused: Enter approves, Esc denies
      </p>
    </div>
  )
}
