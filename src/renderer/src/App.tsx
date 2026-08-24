import { useCallback, useEffect, useRef, useState } from 'react'
import { StatusBar } from './components/status/StatusBar'
import { MessageList } from './components/chat/MessageList'
import { ChatInput } from './components/chat/ChatInput'
import { ConfirmationModal } from './components/confirm/ConfirmationModal'
import { SettingsPanel } from './components/settings/SettingsPanel'
import { Starfield } from './components/ambient/Starfield'
import { VoiceOrb, type OrbState } from './components/orb/VoiceOrb'
import { RailNav, type ViewId } from './components/nav/RailNav'
import { CircuitCards } from './components/circuits/CircuitCards'
import { MemoryPanel } from './components/circuits/MemoryPanel'
import { SkillsPanel } from './components/circuits/SkillsPanel'
import { SoulPanel } from './components/circuits/SoulPanel'
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
import { useWakeWord, isWakeEnabledStored, setWakeEnabledStored } from './hooks/useWakeWord'

const TTS_STORAGE_KEY = 'ashirs.tts-enabled'

type CircuitId = 'memory' | 'skills' | 'soul' | 'settings' | null

export function App() {
  const { messages, busy, send } = useChat()
  const [ttsEnabled, setTtsEnabled] = useState(() => localStorage.getItem(TTS_STORAGE_KEY) === '1')
  const [draft, setDraft] = useState('')
  const { speak, stop } = useSpeech(ttsEnabled)
  const { proposal, busy: deciding, outcome, decide, dismissOutcome } = useProposals()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [circuit, setCircuit] = useState<CircuitId>(null)
  const [view, setView] = useState<ViewId>('core')
  const [updateOpen, setUpdateOpen] = useState(false)
  const { theme, setTheme, cycleTheme } = useTheme()
  const { status: updateStatus, check, install } = useUpdater()
  const updateBadge = updateLabel(updateStatus)

  const handleTranscript = useCallback((text: string): void => {
    setDraft(text)
    setView('core')
  }, [])
  const handleInterim = useCallback((text: string): void => {
    setDraft(text)
  }, [])
  const voice = useVoiceRecorder({ onFinal: handleTranscript, onInterim: handleInterim })

  const busyRef = useRef(busy)
  busyRef.current = busy
  const voiceRef = useRef(voice)
  voiceRef.current = voice

  const [wakeEnabled, setWakeEnabled] = useState(isWakeEnabledStored)
  const handleWake = useCallback((): void => {
    if (busyRef.current || voiceRef.current.recording) return
    setView('core')
    voiceRef.current.toggle()
  }, [])
  const wake = useWakeWord({ enabled: wakeEnabled, onWake: handleWake })

  useEffect(() => {
    if (!wakeEnabled) return
    if (voice.recording) {
      wake.suspend()
    } else if (wake.status === 'suspended') {
      wake.resume()
    }
  }, [voice.recording, wakeEnabled, wake])

  const toggleWake = (): void => {
    setWakeEnabled((prev) => {
      setWakeEnabledStored(!prev)
      return !prev
    })
  }

  useEffect(() => {
    const last = messages[messages.length - 1]
    if (last?.role === 'assistant' && !last.streaming && last.content.length > 0) {
      speak(last.content)
    }
    if (messages.length === 0) stop()
  }, [messages, speak, stop])

  useEffect(() => {
    if (updateStatus.status === 'ready') setUpdateOpen(true)
  }, [updateStatus.status])

  const toggleTts = (): void => {
    setTtsEnabled((prev) => {
      const next = !prev
      localStorage.setItem(TTS_STORAGE_KEY, next ? '1' : '0')
      if (!next) stop()
      return next
    })
  }

  const openCircuit = (id: CircuitId): void => {
    if (id === 'settings') {
      setSettingsOpen(true)
      return
    }
    setCircuit(id)
  }

  const micState = voice.error ? 'denied' : voice.recording ? 'listening' : 'idle'
  const lastProvider = [...messages].reverse().find((m) => m.role === 'assistant')?.provider ?? null
  const orbState: OrbState = busy ? 'thinking' : voice.recording ? 'listening' : 'idle'

  return (
    <div className="relative h-full overflow-hidden bg-base">
      <Starfield />
      <div className="relative z-10 flex h-full flex-col">
        <StatusBar
          micState={micState}
          lastProvider={lastProvider}
          busy={busy}
          theme={theme}
          updateLabel={updateBadge}
          wakeStatus={wakeEnabled ? wake.status : null}
          onCycleTheme={cycleTheme}
          onOpenSettings={() => openCircuit('settings')}
          onUpdateOpen={() => setUpdateOpen(true)}
        />
        <div className="flex min-h-0 flex-1">
          <RailNav view={view} onChange={setView} />

          {view === 'core' && (
            <main className="flex min-h-0 flex-1">
              <section className="hidden min-w-0 flex-1 flex-col items-center justify-center gap-5 md:flex">
                <VoiceOrb state={orbState} level={voice.level} onToggle={voice.toggle} />
                <div className="text-center">
                  <p
                    className={`font-mono text-[11px] uppercase tracking-[0.4em] ${
                      busy || voice.recording ? 'text-accent' : 'text-ink-muted'
                    }`}
                  >
                    {busy ? 'Thinking' : voice.recording ? 'Listening' : 'Online'}
                  </p>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted opacity-60">
                    {voice.recording
                      ? 'Speak freely — words appear as you talk'
                      : busy
                        ? 'Working on it — hold tight'
                        : 'Tap the orb to speak'}
                  </p>
                </div>
                <CircuitCards onOpen={openCircuit} />
              </section>
              <aside className="glass-deep m-3 flex min-h-0 w-full flex-col rounded-xl md:w-[430px] md:shrink-0 lg:w-[480px]">
                <MessageList messages={messages} />
                <ChatInput
                  value={draft}
                  onValueChange={setDraft}
                  busy={busy}
                  ttsEnabled={ttsEnabled}
                  micListening={voice.recording}
                  micLevel={voice.level}
                  voiceNotice={voice.error}
                  onSend={send}
                  onToggleMic={voice.toggle}
                  onToggleTts={toggleTts}
                />
              </aside>
            </main>
          )}

          {view === 'agents' && (
            <main className="min-h-0 flex-1 p-3">
              <div className="glass-deep h-full rounded-xl">
                <AgentTown theme={theme} activity={null} />
              </div>
            </main>
          )}

          {view === 'world' && (
            <main className="min-h-0 flex-1">
              <WorldMonitor />
            </main>
          )}

          {view === 'system' && (
            <main className="min-h-0 flex-1">
              <SystemView />
            </main>
          )}
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
      {circuit === 'memory' && <MemoryPanel onClose={() => setCircuit(null)} />}
      {circuit === 'skills' && <SkillsPanel onClose={() => setCircuit(null)} />}
      {circuit === 'soul' && <SoulPanel onClose={() => setCircuit(null)} />}
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
