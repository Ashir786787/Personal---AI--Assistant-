import type { ActionProposal } from '@shared/ipc'

interface Props {
  proposal: ActionProposal
  busy: boolean
  onDecide: (approved: boolean) => void
}

export function ConfirmationModal({ proposal, busy, onDecide }: Props): JSX.Element {
  return (
    <div className="confirm-backdrop">
      <div className="confirm-card" role="dialog" aria-modal="true" aria-label={proposal.title}>
        <div className="confirm-header">
          <span className="confirm-shield">⚠</span>
          <h2>{proposal.title}</h2>
          <p className="confirm-sub">
            I want to move <strong>{proposal.totalMoves}</strong> file
            {proposal.totalMoves === 1 ? '' : 's'} into typed subfolders. Nothing happens until you
            approve.
          </p>
        </div>

        <ul className="confirm-list">
          {proposal.detailLines.map((line, index) => (
            <li key={`${index}-${line}`}>{line}</li>
          ))}
        </ul>

        <div className="confirm-actions">
          <button className="btn-approve" disabled={busy} onClick={() => onDecide(true)}>
            {busy ? 'Moving…' : 'Approve'}
          </button>
          <button className="btn-cancel" disabled={busy} onClick={() => onDecide(false)}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
