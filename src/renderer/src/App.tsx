import { useCallback, useEffect, useState } from 'react'
import { StatusBar } from './components/status/StatusBar'
import { MessageList } from './components/chat/MessageList'
import { ChatInput } from './components/chat/ChatInput'
import { ConfirmationModal } from './components/confirm/ConfirmationModal'
import { SettingsPanel } from './components/settings/SettingsPanel'
import { Starfield } from './components/ambient/Starfield'
import { VoiceOrb, type OrbState } from './components/orb/VoiceOrb'
import { useChat } from './hooks/useChat'
import { useVoiceRecorder } from './hooks/useVoiceRecorder'
import { useSpeech } from './hooks/useSpeech'
import { useProposals } from './hooks/useProposals'
import { useTheme } from './hooks/useTheme'

const TTS_STORAGE_KEY = 'ashirs.tts-enabled'

export function App() {
  const { messages, busy, send } = useChat()
  const [ttsEnabled, setTtsEnabled] = useState(() => localStorage.getItem(TTS_STORAGE_KEY) === '1')
  const [draft, setDraft] = useState('')
  const { speak, stop } = useSpeech(ttsEnabled)
  const { proposal, busy: deciding, outcome, decide, dismissOutcome } = useProposals()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { theme, setTheme, cycleTheme } = useTheme()

  const handleTranscript = useCallback((text: string): void => {
    setDraft(text)
  }, [])
  const handleInterim = useCallback((text: string): void => {
    setDraft(text)
  }, [])
  const voice = useVoiceRecorder({ onFinal: handleTranscript, onInterim: handleInterim })

  useEffect(() => {
    const last = messages[messages.length - 1]
    if (last?.role === 'assistant' && !last.streaming && last.content.length > 0) {
      speak(last.content)
    }
    if (messages.length === 0) stop()
  }, [messages, speak, stop])

  const toggleTts = (): void => {
    setTtsEnabled((prev) => {
      const next = !prev
      localStorage.setItem(TTS_STORAGE_KEY, next ? '1' : '0')
      if (!next) stop()
      return next
    })
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
          onCycleTheme={cycleTheme}
          onOpenSettings={() => setSettingsOpen(true)}
        />
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
      {settingsOpen && (
        <SettingsPanel onClose={() => setSettingsOpen(false)} theme={theme} onSetTheme={setTheme} />
      )}
    </div>
  )
}
