import { useEffect, useState } from 'react'
import type { ProviderKeyStatus } from '@shared/ipc'
import { THEME_ACCENT, THEME_IDS, THEME_LABEL, type ThemeId } from '../../theme'
import { useUpdater, updateLabel } from '../../hooks/useUpdater'
import type { WakeStatus } from '../../hooks/useWakeWord'

interface Props {
  onClose: () => void
  theme: ThemeId
  onSetTheme: (theme: ThemeId) => void
  wakeEnabled: boolean
  wakeStatus: WakeStatus
  onToggleWake: () => void
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function SettingsPanel({
  onClose,
  theme,
  onSetTheme,
  wakeEnabled,
  wakeStatus,
  onToggleWake
}: Props): JSX.Element {
  const [status, setStatus] = useState<ProviderKeyStatus>({ gemini: false, groq: false })
  const [geminiKey, setGeminiKey] = useState('')
  const [groqKey, setGroqKey] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearing, setClearing] = useState(false)
  const { status: updateStatus, check } = useUpdater()
  const [appVersion, setAppVersion] = useState('')
  const [wakeKey, setWakeKey] = useState('')
  const [wakeSaved, setWakeSaved] = useState(false)
  const [wakeError, setWakeError] = useState<string | null>(null)
  const [checkNote, setCheckNote] = useState<string | null>(null)

  useEffect(() => {
    void window.ashirs.getVersion().then(setAppVersion)
  }, [])

  useEffect(() => {
    if (updateStatus.status === 'checking') {
      setCheckNote('Checking for updates…')
      return undefined
    }
    if (updateStatus.status === 'not-available') {
      setCheckNote(`You are on the latest version${appVersion ? ` (${appVersion})` : ''}`)
      const timer = setTimeout(() => setCheckNote(null), 6000)
      return () => clearTimeout(timer)
    }
    if (updateStatus.status === 'error') {
      setCheckNote(updateStatus.message)
    }
    return undefined
  }, [updateStatus, appVersion])

  const doClear = async (really: boolean): Promise<void> => {
    if (!really) return
    setClearing(true)
    try {
      await window.ashirs.clearChat()
      setConfirmClear(false)
    } finally {
      setClearing(false)
    }
  }

  useEffect(() => {
    void window.ashirs.getKeyStatus().then(setStatus)
  }, [])

  const save = async (provider: 'gemini' | 'groq', key: string): Promise<void> => {
    if (key.trim().length === 0) return
    setSaveState('saving')
    setError(null)
    try {
      await window.ashirs.setProviderKey(provider, key.trim())
      const next = await window.ashirs.getKeyStatus()
      setStatus(next)
      if (provider === 'gemini') setGeminiKey('')
      else setGroqKey('')
      setSaveState('saved')
    } catch (err) {
      setSaveState('error')
      setError(err instanceof Error ? err.message : 'Could not save the key')
    }
  }

  const dot = (live: boolean): string => (live ? 'bg-emerald-400' : 'bg-zinc-600')

  const saveWakeKey = async (): Promise<void> => {
    if (wakeKey.trim().length === 0) return
    setWakeSaved(false)
    setWakeError(null)
    try {
      await window.ashirs.setWakeKey(wakeKey.trim())
      setWakeKey('')
      setWakeSaved(true)
    } catch (err) {
      setWakeError(err instanceof Error ? err.message : 'Could not save the key')
    }
  }

  const wakeStateLine = (): string => {
    if (!wakeEnabled) return 'Off — tap the orb or type instead'
    switch (wakeStatus) {
      case 'armed':
        return 'Listening for "Jarvis" — just say the word'
      case 'starting':
        return 'Arming…'
      case 'suspended':
        return 'Standing by while I listen to you'
      case 'no-key':
        return 'Needs a free Picovoice access key below'
      case 'error':
        return 'Engine error — check the key and toggle again'
      default:
        return 'Off'
    }
  }

  return (
    <div className="confirm-backdrop">
      <div
        className="confirm-card settings-card"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        <div className="confirm-header">
          <h2>Settings</h2>
          <p className="confirm-sub">
            API keys are encrypted with Windows DPAPI and tied to this user account. They never
            leave this machine except to call the provider you chose.
          </p>
        </div>

        <div className="settings-body">
          <div className="settings-row">
            <span
              className={`h-1.5 w-1.5 rounded-full ${appVersion ? 'bg-accent' : 'bg-zinc-600'}`}
            />
            <div className="settings-provider">
              <strong>Version</strong>
              <span>
                {updateLabel(updateStatus) ? `Update ${updateLabel(updateStatus)}` : 'Up to date'}
              </span>
            </div>
            <div className="flex flex-1 items-center gap-3">
              <span className="font-mono text-xs text-ink-muted">{appVersion || '…'}</span>
              <button
                className="btn-cancel btn-small"
                disabled={updateStatus.status === 'checking'}
                onClick={check}
              >
                {updateStatus.status === 'checking' ? 'Checking…' : 'Check for updates'}
              </button>
            </div>
          </div>
          {checkNote && <p className="settings-ok">{checkNote}</p>}

          <div className="settings-row">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            <div className="settings-provider">
              <strong>Theme</strong>
              <span>Recolors the whole interface</span>
            </div>
            <div className="flex flex-1 gap-2">
              {THEME_IDS.map((id) => (
                <button
                  key={id}
                  className={`theme-pill ${theme === id ? 'theme-pill-active' : ''}`}
                  onClick={() => onSetTheme(id)}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: THEME_ACCENT[id] }}
                  />
                  {THEME_LABEL[id]}
                </button>
              ))}
            </div>
          </div>

          <div className="settings-row">
            <span className={`h-1.5 w-1.5 rounded-full ${dot(status.gemini)}`} />
            <div className="settings-provider">
              <strong>Gemini</strong>
              <span>{status.gemini ? 'Connected' : 'No key yet'}</span>
            </div>
            <input
              type="password"
              placeholder="Paste Gemini API key"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
            />
            <button
              className="btn-approve btn-small"
              disabled={geminiKey.trim().length === 0 || saveState === 'saving'}
              onClick={() => void save('gemini', geminiKey)}
            >
              Save
            </button>
          </div>

          <div className="settings-row">
            <span className={`h-1.5 w-1.5 rounded-full ${dot(status.groq)}`} />
            <div className="settings-provider">
              <strong>Groq</strong>
              <span>{status.groq ? 'Connected' : 'No key yet'}</span>
            </div>
            <input
              type="password"
              placeholder="Paste Groq API key"
              value={groqKey}
              onChange={(e) => setGroqKey(e.target.value)}
            />
            <button
              className="btn-approve btn-small"
              disabled={groqKey.trim().length === 0 || saveState === 'saving'}
              onClick={() => void save('groq', groqKey)}
            >
              Save
            </button>
          </div>

          {saveState === 'saved' && <p className="settings-ok">Saved — encrypted on disk</p>}
          {error && <p className="settings-err">{error}</p>}

          <div className="settings-row settings-row-top">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                wakeStatus === 'armed'
                  ? 'bg-accent animate-pulse'
                  : wakeStatus === 'no-key' || wakeStatus === 'error'
                    ? 'bg-warning'
                    : 'bg-zinc-600'
              }`}
            />
            <div className="settings-provider">
              <strong>Wake word</strong>
              <span>{wakeStateLine()}</span>
            </div>
            <button
              className={`${wakeEnabled ? 'btn-approve' : 'btn-cancel'} btn-small`}
              onClick={onToggleWake}
            >
              {wakeEnabled ? 'On' : 'Off'}
            </button>
          </div>

          {(wakeEnabled || wakeKey.length > 0) && (
            <div className="settings-row">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
              <div className="settings-provider">
                <strong>Picovoice key</strong>
                <span>
                  Free at console.picovoice.ai — stays encrypted on this PC. Audio for the wake word
                  never leaves your machine.
                </span>
              </div>
              <input
                type="password"
                placeholder="Paste Picovoice AccessKey"
                value={wakeKey}
                onChange={(e) => setWakeKey(e.target.value)}
              />
              <button
                className="btn-approve btn-small"
                disabled={wakeKey.trim().length === 0}
                onClick={() => void saveWakeKey()}
              >
                Save
              </button>
            </div>
          )}
          {wakeSaved && (
            <p className="settings-ok">Wake-word key saved — toggle it back on to arm</p>
          )}
          {wakeError && <p className="settings-err">{wakeError}</p>}

          <div className="settings-row settings-row-top">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" />
            <div className="settings-provider">
              <strong>Conversation</strong>
              <span>Wipes chat history from this machine</span>
            </div>
            {confirmClear ? (
              <div className="flex flex-1 items-center gap-2">
                <span className="text-xs text-warning">Erase all memory?</span>
                <button
                  className="btn-cancel btn-small"
                  disabled={clearing}
                  onClick={() => void doClear(true)}
                >
                  {clearing ? 'Erasing…' : 'Yes, erase'}
                </button>
                <button
                  className="btn-cancel btn-small"
                  disabled={clearing}
                  onClick={() => setConfirmClear(false)}
                >
                  Keep
                </button>
              </div>
            ) : (
              <button className="btn-cancel btn-small" onClick={() => setConfirmClear(true)}>
                Clear conversation
              </button>
            )}
          </div>
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
