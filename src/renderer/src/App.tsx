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
import { isSignificantTranscript } from './lib/transcriptFilter'
import { stripWakePrefix } from './lib/wake-phrases'

const TTS_STORAGE_KEY = 'ashirs.tts-enabled'
const WAKING_PROMPT = 'Yes, boss?'
const FOLLOW_UP_PROMPT = 'Anything else, boss?'
const FIRST_LISTEN_MS = 15000
const FOLLOW_LISTEN_MS = 7000

type LoopPhase = 'off' | 'awaiting' | 'working' | 'following'

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
      if (!isSignificantTranscript(text)) {
        setDraft('')
        return
      }
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

  const handleQuietTranscript = useCallback(
    (text: string): void => {
      const phase = loopPhaseRef.current
      if (phase !== 'awaiting' && phase !== 'following') return

      if (!isSignificantTranscript(text)) {
        setLoopPhase('off')
        return
      }
      const command = stripWakePrefix(text)
      if (command.length === 0) {
        setLoopPhase('off')
        return
      }
      setDraft('')
      setView('core')
      loopPhaseRef.current = 'working'
      setLoopPhase('working')
      sendAndAsk(command)
    },
    [sendAndAsk]
  )

  const voice = useVoiceRecorder({
    onFinal: handleTranscript,
    onInterim: handleInterim,
    onQuiet: handleQuietTranscript
  })

  const voiceRef = useRef(voice)
  voiceRef.current = voice

  const [wakeEnabled, setWakeEnabled] = useState(isWakeEnabledStored)
  const ttsRef = useRef(ttsEnabled)
  ttsRef.current = ttsEnabled

  const [loopPhase, setLoopPhase] = useState<LoopPhase>('off')
  const loopPhaseRef = useRef('off' as LoopPhase)
  loopPhaseRef.current = loopPhase
  const listeningStartedRef = useRef(false)
  const speakingPrevRef = useRef(false)
  const speakingRef = useRef(speaking)
  speakingRef.current = speaking

  const handleWake = useCallback((): void => {
    if (!poweredRef.current || busyRef.current || loopPhaseRef.current !== 'off') return
    if (voiceRef.current.recording || speaking) return
    setView('core')
    listeningStartedRef.current = false
    loopPhaseRef.current = 'awaiting'
    setLoopPhase('awaiting')
    if (ttsRef.current) speak(WAKING_PROMPT)
  }, [speak, speaking])
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

  // Hands-free loop: after the wake ack (or the follow-up prompt) finishes being
  // spoken, open the mic and wait for the command. Silence closes it again.
  useEffect(() => {
    const phase = loopPhaseRef.current
    if (phase !== 'awaiting' && phase !== 'following') {
      listeningStartedRef.current = false
      return
    }
    if (speaking || voiceRef.current.recording || listeningStartedRef.current) return
    listeningStartedRef.current = true
    const noSpeechMs = phase === 'awaiting' ? FIRST_LISTEN_MS : FOLLOW_LISTEN_MS
    voiceRef.current.listen({ quiet: true, noSpeechMs })
  }, [loopPhase, speaking, voice.recording])

  // While a task runs, wait for the assistant to finish and fall silent, then
  // offer the follow-up prompt. Skipped while an approval dialog is open.
  useEffect(() => {
    const fellSilent = speakingPrevRef.current && !speaking
    speakingPrevRef.current = speaking

    if (loopPhaseRef.current !== 'working' || busy) return
    if (ttsEnabled && !fellSilent) return
    if (proposal !== null) return

    listeningStartedRef.current = false
    loopPhaseRef.current = 'following'
    setLoopPhase('following')
    if (ttsRef.current) speak(FOLLOW_UP_PROMPT)
  }, [busy, speaking, ttsEnabled, proposal, loopPhase, speak])

  // Safety net: if the assistant answered without triggering TTS, still move to
  // the follow-up prompt after a short grace period instead of hanging forever.
  useEffect(() => {
    if (loopPhaseRef.current !== 'working') return
    const timer = window.setTimeout(() => {
      if (loopPhaseRef.current !== 'working' || busyRef.current) return
      if (speakingRef.current || proposal !== null) return
      listeningStartedRef.current = false
      loopPhaseRef.current = 'following'
      setLoopPhase('following')
      if (ttsRef.current) speak(FOLLOW_UP_PROMPT)
    }, 4500)
    return () => window.clearTimeout(timer)
  }, [busy, proposal, loopPhase, speak])

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
    loopPhaseRef.current = 'off'
    setLoopPhase('off')
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
    loopPhaseRef.current = 'off'
    setLoopPhase('off')
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
              <AgentTown
                theme={theme}
                focused={view === 'agents'}
                approvalOpen={proposal !== null}
              />
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
