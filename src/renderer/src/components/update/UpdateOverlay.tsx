import type { UpdateStatus } from '@shared/ipc'

interface Props {
  status: UpdateStatus
  onClose: () => void
  onCheck: () => void
  onInstall: () => void
}

export function UpdateOverlay({ status, onClose, onCheck, onInstall }: Props): JSX.Element {
  const busy = status.status === 'checking' || status.status === 'downloading'
  return (
    <div className="confirm-backdrop" onClick={onClose}>
      <div
        className="confirm-card update-card"
        role="dialog"
        aria-modal="true"
        aria-label="Software update"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-header">
          <span className="confirm-shield">⭮</span>
          <h2>Update Center</h2>
          <p className="confirm-sub">
            New builds are published automatically. When one is ready you can install it right from
            here — no folders, no manual setup.
          </p>
        </div>

        <div className="settings-body">
          {status.status === 'idle' && (
            <p className="update-line">You are on the latest published build.</p>
          )}
          {status.status === 'not-available' && (
            <p className="update-line text-accent">Checked — you are running the latest version.</p>
          )}
          {status.status === 'checking' && <p className="update-line">Checking for updates…</p>}
          {status.status === 'available' && (
            <p className="update-line text-accent">
              Version {status.version} is available — downloading in the background.
            </p>
          )}
          {status.status === 'downloading' && (
            <>
              <p className="update-line">
                Downloading version… <span className="text-accent">{status.percent}%</span>
              </p>
              <div className="update-bar">
                <div className="update-bar-fill" style={{ width: `${status.percent}%` }} />
              </div>
            </>
          )}
          {status.status === 'ready' && (
            <p className="update-line text-accent">
              Version {status.version} is ready to install. The app restarts itself after.
            </p>
          )}
          {status.status === 'error' && <p className="settings-err">{status.message}</p>}
        </div>

        <div className="confirm-actions">
          <button className="btn-cancel" disabled={busy} onClick={onCheck}>
            Check now
          </button>
          {status.status === 'ready' && (
            <button className="btn-approve" onClick={onInstall}>
              Install &amp; restart
            </button>
          )}
          <button className="btn-cancel" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
