import { useCallback, useEffect, useState } from 'react'
import { StatusBar } from './components/status/StatusBar'
import { MessageList } from './components/chat/MessageList'
import { ChatInput } from './components/chat/ChatInput'
import { ConfirmationModal } from './components/confirm/ConfirmationModal'
import { useChat } from './hooks/useChat'
import { useVoiceRecorder } from './hooks/useVoiceRecorder'
import { useSpeech } from './hooks/useSpeech'
import { useProposals } from './hooks/useProposals'

const TTS_STORAGE_KEY = 'ashirs.tts-enabled'

export function App() {
  const { messages, busy, send } = useChat()
  const [ttsEnabled, setTtsEnabled] = useState(() => localStorage.getItem(TTS_STORAGE_KEY) === '1')
  const [draft, setDraft] = useState('')
  const { speak, stop } = useSpeech(ttsEnabled)
  const { proposal, busy: deciding, outcome, decide, dismissOutcome } = useProposals()

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

  return (
    <div className="flex h-full flex-col bg-base">
      <StatusBar micState={micState} lastProvider={lastProvider} busy={busy} />
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
    </div>
  )
}
