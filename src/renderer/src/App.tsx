import { useCallback, useEffect, useState } from 'react'
import { StatusBar } from './components/status/StatusBar'
import { MessageList } from './components/chat/MessageList'
import { ChatInput } from './components/chat/ChatInput'
import { useChat } from './hooks/useChat'
import { useAudioLevel } from './hooks/useAudioLevel'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import { useSpeech } from './hooks/useSpeech'

const TTS_STORAGE_KEY = 'ashirs.tts-enabled'

export function App() {
  const { messages, busy, send } = useChat()
  const [ttsEnabled, setTtsEnabled] = useState(() => localStorage.getItem(TTS_STORAGE_KEY) === '1')
  const [micDenied, setMicDenied] = useState(false)
  const { speak, stop } = useSpeech(ttsEnabled)

  const handleTranscript = useCallback((text: string) => send(text), [send])
  const {
    listening,
    unavailableReason,
    start,
    stop: stopListening
  } = useSpeechRecognition(handleTranscript)
  const level = useAudioLevel(listening)

  useEffect(() => {
    const last = messages[messages.length - 1]
    if (last?.role === 'assistant' && !last.streaming && last.content.length > 0) {
      speak(last.content)
    }
    if (messages.length === 0) stop()
  }, [messages, speak, stop])

  const toggleMic = (): void => {
    if (listening) {
      stopListening()
      return
    }
    stop()
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((probe) => {
        probe.getTracks().forEach((track) => track.stop())
        setMicDenied(false)
        start()
      })
      .catch(() => {
        setMicDenied(true)
        start()
      })
  }

  const toggleTts = (): void => {
    setTtsEnabled((prev) => {
      const next = !prev
      localStorage.setItem(TTS_STORAGE_KEY, next ? '1' : '0')
      if (!next) stop()
      return next
    })
  }

  const micState = micDenied ? 'denied' : listening ? 'listening' : 'idle'
  const lastProvider = [...messages].reverse().find((m) => m.role === 'assistant')?.provider ?? null

  return (
    <div className="flex h-full flex-col bg-base">
      <StatusBar micState={micState} lastProvider={lastProvider} busy={busy} />
      <MessageList messages={messages} />
      <ChatInput
        busy={busy}
        ttsEnabled={ttsEnabled}
        micListening={listening}
        micLevel={level}
        voiceUnavailableReason={unavailableReason}
        onSend={send}
        onToggleMic={toggleMic}
        onToggleTts={toggleTts}
      />
    </div>
  )
}
