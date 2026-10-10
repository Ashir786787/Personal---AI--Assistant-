import { useEffect, useState } from 'react'
import type { MemorySummary, ProviderKeyStatus, WakeModelStateInfo } from '@shared/ipc'
import { THEME_ACCENT, THEME_IDS, THEME_LABEL, type ThemeId } from '../../theme'
import { useUpdater, updateLabel } from '../../hooks/useUpdater'
import type { WakeStatus } from '../../hooks/useWakeWord'
import { systemPrefersReducedMotion, type MotionSetting } from '../../hooks/useReducedMotion'

interface Props {
  onClose: () => void
  theme: ThemeId
  onSetTheme: (theme: ThemeId) => void
  wakeEnabled: boolean
  wakeStatus: WakeStatus
  wakeDownloadPercent: number | null
  wakeError: string | null
  wakePhrases: readonly string[]
  onToggleWake: () => void
  motionSetting: MotionSetting
  onSetMotionSetting: (next: MotionSetting) => void
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function SettingsPanel({
  onClose,
  theme,
  onSetTheme,
  wakeEnabled,
  wakeStatus,
  wakeDownloadPercent,
  wakeError,
  wakePhrases,
  onToggleWake,
  motionSetting,
  onSetMotionSetting
}: Props): JSX.Element {
  const [status, setStatus] = useState<ProviderKeyStatus>({ gemini: false, groq: false })
  const [geminiKey, setGeminiKey] = useState('')
  const [groqKey, setGroqKey] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [clearNote, setClearNote] = useState<string | null>(null)
  const [summary, setSummary] = useState<MemorySummary | null>(null)
  const { status: updateStatus, check } = useUpdater()
  const [appVersion, setAppVersion] = useState('')
  const [checkNote, setCheckNote] = useState<string | null>(null)
  const [modelInfo, setModelInfo] = useState<WakeModelStateInfo>({ state: 'missing' })

  useEffect(() => {
    void window.ashirs.getVersion().then(setAppVersion)
    void window.ashirs.getWakeModelState().then(setModelInfo)
    const unsubscribe = window.ashirs.onWakeModelProgress(setModelInfo)
    return unsubscribe
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
    setClearNote(null)
    try {
      // "Delete all my data" has to reach the four town agents' memories too, so this
      // reports exactly what was wiped and what was not.
      const result = await window.ashirs.clearAllMemory()
      setConfirmClear(false)
      const total = result.cleared.length
      setClearNote(
        result.failed.length === 0
          ? `Erased ${total} store${total === 1 ? '' : 's'} on this machine.`
          : `Erased ${total} store${total === 1 ? '' : 's'}, but ${result.failed.join(', ')} could not be erased.`
      )
      const summary = await window.ashirs.memorySummary()
      setSummary(summary)
    } catch (err) {
      setClearNote(err instanceof Error ? err.message : 'Could not erase the data')
    } finally {
      setClearing(false)
    }
  }

  useEffect(() => {
    void window.ashirs.getKeyStatus().then(setStatus)
    void window.ashirs.memorySummary().then(setSummary)
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

  const wakeStateLine = (): string => {
    if (!wakeEnabled) return 'Off — tap the orb or type instead'
    if (wakeError) return wakeError
    switch (wakeStatus) {
      case 'downloading':
        return `Downloading voice brain… ${wakeDownloadPercent ?? modelInfo.percent ?? 0}% (one time)`
      case 'preparing':
      case 'starting':
        return 'Arming… unpacking the voice brain — can take a minute'
      case 'armed':
        return `Say "${wakePhrases[0]}" — just talk normally`
      case 'suspended':
        return 'Standing by while I listen to you'
      case 'error':
        return 'Engine error after retries — toggle off and on to retry'
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
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            <div className="settings-provider">
              <strong>Reduce motion</strong>
              <span>
                Stops interface animation. Auto follows the Windows setting
                {systemPrefersReducedMotion() ? ', which is currently on' : ''}.
              </span>
            </div>
            <div className="flex flex-1 gap-2" role="group" aria-label="Reduce motion">
              {(['auto', 'reduced'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={motionSetting === option}
                  className={`theme-pill ${motionSetting === option ? 'theme-pill-active' : ''}`}
                  onClick={() => onSetMotionSetting(option)}
                >
                  {option === 'auto' ? 'Auto' : 'Always reduce'}
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
                  : wakeStatus === 'error' || wakeStatus === 'downloading'
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

          {wakeEnabled && (
            <>
              {wakeStatus === 'downloading' && (
                <div className="settings-row">
                  <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                  <div className="settings-provider">
                    <strong>Voice model download</strong>
                    <span>~42 MB, one time — runs in the background</span>
                  </div>
                </div>
              )}
              <div className="settings-row">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
                <div className="settings-provider">
                  <strong>Say any of these</strong>
                  <span>All processed on this PC only — no audio ever leaves it.</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {wakePhrases.map((phrase) => (
                    <span key={phrase} className="chip chip-neutral">
                      "{phrase}"
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
          {modelInfo.state === 'error' && (
            <p className="settings-err">Model download failed: {modelInfo.error}</p>
          )}

          <div className="settings-row settings-row-top">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" />
            <div className="settings-provider">
              <strong>Delete all my data</strong>
              <span>
                Erases the chat and every town agent&apos;s memory on this machine
                {summary !== null &&
                  ` — ${summary.storeCount} store${summary.storeCount === 1 ? '' : 's'}, ${
                    summary.messageCount + summary.agentMessageCount
                  } message${summary.messageCount + summary.agentMessageCount === 1 ? '' : 's'} right now`}
                . Keys stay encrypted and are kept until you clear them above.
              </span>
            </div>
            {confirmClear ? (
              <div className="flex flex-1 items-center gap-2">
                <span className="text-xs text-warning">
                  Erase all {summary?.storeCount ?? 5} stores?
                </span>
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
                Delete all my data
              </button>
            )}
          </div>
          {clearNote && <p className="settings-err">{clearNote}</p>}
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
