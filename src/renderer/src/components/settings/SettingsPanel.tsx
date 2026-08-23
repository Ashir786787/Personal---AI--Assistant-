import { useEffect, useState } from 'react'
import type { ProviderKeyStatus } from '@shared/ipc'
import { THEME_ACCENT, THEME_IDS, THEME_LABEL, type ThemeId } from '../../theme'

interface Props {
  onClose: () => void
  theme: ThemeId
  onSetTheme: (theme: ThemeId) => void
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function SettingsPanel({ onClose, theme, onSetTheme }: Props): JSX.Element {
  const [status, setStatus] = useState<ProviderKeyStatus>({ gemini: false, groq: false })
  const [geminiKey, setGeminiKey] = useState('')
  const [groqKey, setGroqKey] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearing, setClearing] = useState(false)

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
