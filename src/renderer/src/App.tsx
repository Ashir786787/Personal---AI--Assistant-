import { useCallback, useEffect, useRef, useState } from 'react'
import { StatusBar } from './components/status/StatusBar'
import { ChatPanel } from './components/chat/ChatPanel'
import { ConfirmationModal } from './components/confirm/ConfirmationModal'
import { SettingsPanel } from './components/settings/SettingsPanel'
import { Starfield } from './components/ambient/Starfield'
import { CoreView } from './components/core/CoreView'
import { RailNav, type ViewId } from './components/nav/RailNav'
import { AgentTown } from './components/town/AgentTown'
import { WorldMonitor } from './components/world/WorldMonitor'
import { SystemView } from './components/system/SystemView'
import { UpdateOverlay } from './components/update/UpdateOverlay'
import { useChat } from './hooks/useChat'
import { useVoiceRecorder } from './hooks/useVoiceRecorder'
import { useSpeech } from './hooks/useSpeech'
import { useProposals } from './hooks/useProposals'
import { useTheme } from './hooks/useTheme'
import { useUpdater, updateLabel } from './hooks/useUpdater'
import { usePowerState } from './hooks/usePowerState'
import { isPowered } from './state/powerState'
import { useWakeWord, isWakeEnabledStored, setWakeEnabledStored } from './hooks/useWakeWord'

const TTS_STORAGE_KEY = 'ashirs.tts-enabled'

export function App() {
  const { messages, busy, send } = useChat()
  const busyRef = useRef(busy)
  busyRef.current = busy
  const [ttsEnabled, setTtsEnabled] = useState(() => localStorage.getItem(TTS_STORAGE_KEY) === '1')
  const [draft, setDraft] = useState('')
  const { speak, stop, speaking } = useSpeech(ttsEnabled)
  const { proposal, busy: deciding, outcome, decide, dismissOutcome } = useProposals()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [view, setView] = useState<ViewId>('core')
  const [updateOpen, setUpdateOpen] = useState(false)
  const { theme, setTheme, cycleTheme } = useTheme()
  const { status: updateStatus, check, install } = useUpdater()
  const updateBadge = updateLabel(updateStatus)
  const { state: power, dispatch: powerEvent } = usePowerState()
  const powered = isPowered(power.status)
  const poweredRef = useRef(powered)
  poweredRef.current = powered

  const sendAndAsk = useCallback(
    (text: string): void => {
      if (!poweredRef.current) return
      powerEvent({ type: 'ASK' })
      send(text)
    },
    [powerEvent, send]
  )

  const handleTranscript = useCallback(
    (text: string): void => {
      setView('core')
      if (busyRef.current) {
        setDraft(text)
        return
      }
      setDraft('')
      sendAndAsk(text)
    },
    [sendAndAsk]
  )
  const handleInterim = useCallback((text: string): void => {
    setDraft(text)
  }, [])
  const voice = useVoiceRecorder({ onFinal: handleTranscript, onInterim: handleInterim })

  const voiceRef = useRef(voice)
  voiceRef.current = voice

  const [wakeEnabled, setWakeEnabled] = useState(isWakeEnabledStored)

  const handleWake = useCallback((): void => {
    if (!poweredRef.current || busyRef.current || voiceRef.current.recording) return
    setView('core')
    voiceRef.current.toggle()
  }, [])
  const wake = useWakeWord({
    enabled: wakeEnabled && powered,
    onWake: handleWake
  })
  const wakeSuspendRef = useRef(wake.suspend)
  wakeSuspendRef.current = wake.suspend
  const wakeResumeRef = useRef(wake.resume)
  wakeResumeRef.current = wake.resume

  useEffect(() => {
    if (!wakeEnabled || !powered) return
    if (voice.recording || speaking) {
      wakeSuspendRef.current()
    } else if (wake.status === 'suspended') {
      wakeResumeRef.current()
    }
  }, [voice.recording, speaking, wakeEnabled, powered, wake.status])

  useEffect(() => {
    if (wakeEnabled && powered && wake.status === 'error') {
      setWakeEnabled(false)
      setTimeout(() => setWakeEnabled(true), 1000)
    }
  }, [wakeEnabled, powered, wake.status])

  const toggleWake = (): void => {
    setWakeEnabled((prev) => {
      setWakeEnabledStored(!prev)
      return !prev
    })
  }

  useEffect(() => {
    if (voice.recording) {
      if (power.status === 'idle' || power.status === 'error' || power.status === 'mic-denied') {
        powerEvent({ type: 'LISTEN' })
      }
    } else if (power.status === 'listening') {
      powerEvent({ type: 'LISTENED' })
    }
  }, [voice.recording, power.status, powerEvent])

  useEffect(() => {
    if (voice.error && /denied/i.test(voice.error)) {
      powerEvent({ type: 'MIC_BLOCKED' })
    }
  }, [voice.error, powerEvent])

  useEffect(() => {
    if (speaking) {
      powerEvent({ type: 'SPEAK' })
    } else if (power.status === 'speaking') {
      powerEvent({ type: 'SPOKE' })
    }
  }, [speaking, power.status, powerEvent])

  useEffect(() => {
    const last = messages[messages.length - 1]
    if (last?.role === 'assistant' && !last.streaming && last.content.length > 0 && ttsEnabled) {
      speak(last.content)
    }
  }, [messages, ttsEnabled, speak])

  useEffect(() => {
    const last = messages[messages.length - 1]
    if (power.status === 'thinking' && !busy && !speaking) {
      if (last?.role === 'error') {
        powerEvent({ type: 'FAIL', message: last.content })
      } else if (!ttsEnabled) {
        powerEvent({ type: 'ANSWER' })
      }
    }
  }, [messages, busy, speaking, power.status, ttsEnabled, powerEvent])

  useEffect(() => {
    if (messages.length === 0) stop()
  }, [messages, stop])

  useEffect(() => {
    if (updateStatus.status === 'ready') setUpdateOpen(true)
  }, [updateStatus.status])

  const openUpdateCenter = useCallback((): void => {
    setUpdateOpen(true)
    if (updateStatus.status === 'idle' || updateStatus.status === 'not-available') check()
  }, [updateStatus.status, check])

  const handleClearChat = useCallback(async (): Promise<void> => {
    await window.ashirs.clearChat()
    setDraft('')
    stop()
  }, [stop])

  const toggleTts = (): void => {
    setTtsEnabled((prev) => {
      const next = !prev
      localStorage.setItem(TTS_STORAGE_KEY, next ? '1' : '0')
      if (!next) stop()
      return next
    })
  }

  const togglePower = (): void => {
    if (power.status === 'off') {
      powerEvent({ type: 'START' })
      return
    }
    stop()
    if (voice.recording) voiceRef.current.toggle()
    powerEvent({ type: 'STOP' })
  }

  const micState = voice.error ? 'denied' : voice.recording ? 'listening' : 'idle'
  const lastProvider = [...messages].reverse().find((m) => m.role === 'assistant')?.provider ?? null

  return (
    <div className="relative h-full overflow-hidden bg-base">
      <Starfield />
      <div className="relative z-10 flex h-full flex-col">
        <StatusBar
          micState={micState}
          power={power.status}
          lastProvider={lastProvider}
          busy={busy}
          theme={theme}
          updateLabel={updateBadge}
          wakeStatus={wakeEnabled ? wake.status : null}
          onCycleTheme={cycleTheme}
          onOpenSettings={() => setSettingsOpen(true)}
          onUpdateOpen={openUpdateCenter}
          onPowerToggle={togglePower}
        />
        <div className="flex min-h-0 flex-1">
          <RailNav view={view} onChange={setView} />

          <main className="min-h-0 flex-1">
            {view === 'core' && (
              <CoreView
                power={power}
                wakeOn={wakeEnabled && powered}
                level={voice.level}
                onStart={() => powerEvent({ type: 'START' })}
                onStop={togglePower}
                onToggleMic={voice.toggle}
                onOpenSettings={() => setSettingsOpen(true)}
              />
            )}

            {view === 'agents' && (
              <div className="h-full p-3">
                <div className="glass-deep h-full rounded-xl">
                  <AgentTown theme={theme} activity={null} />
                </div>
              </div>
            )}

            {view === 'world' && (
              <div className="h-full">
                <WorldMonitor />
              </div>
            )}

            {view === 'system' && (
              <div className="h-full">
                <SystemView />
              </div>
            )}
          </main>

          <ChatPanel
            messages={messages}
            busy={busy}
            powered={powered}
            value={draft}
            onValueChange={setDraft}
            ttsEnabled={ttsEnabled}
            micListening={voice.recording}
            micLevel={voice.level}
            voiceNotice={voice.error}
            onSend={sendAndAsk}
            onToggleMic={voice.toggle}
            onToggleTts={toggleTts}
            onClear={handleClearChat}
          />
        </div>
      </div>

      {outcome && (
        <div
          className={`action-toast ${outcome.approved ? 'toast-ok' : 'toast-cancel'}`}
          onClick={dismissOutcome}
        >
          {outcome.message}
        </div>
      )}
      {proposal && (
        <ConfirmationModal proposal={proposal} busy={deciding} onDecide={(ok) => void decide(ok)} />
      )}
      {updateOpen && (
        <UpdateOverlay
          status={updateStatus}
          onClose={() => setUpdateOpen(false)}
          onCheck={check}
          onInstall={install}
        />
      )}
      {settingsOpen && (
        <SettingsPanel
          onClose={() => setSettingsOpen(false)}
          theme={theme}
          onSetTheme={setTheme}
          wakeEnabled={wakeEnabled}
          wakeStatus={wake.status}
          wakeDownloadPercent={wake.downloadPercent}
          wakeError={wake.error}
          wakePhrases={wake.phrases}
          onToggleWake={toggleWake}
        />
      )}
    </div>
  )
}
