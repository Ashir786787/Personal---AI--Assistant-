import { useCallback, useEffect, useRef, useState } from 'react'

interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>
}

interface RecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  onresult: ((event: RecognitionResultEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

type RecognitionCtor = new () => RecognitionLike

function getRecognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor
    webkitSpeechRecognition?: RecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function useSpeechRecognition(onFinalText: (text: string) => void): {
  listening: boolean
  unavailableReason: string | null
  start: () => void
  stop: () => void
} {
  const [listening, setListening] = useState(false)
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null)
  const recognition = useRef<RecognitionLike | null>(null)
  const onFinalTextRef = useRef(onFinalText)
  onFinalTextRef.current = onFinalText

  useEffect(() => {
    return () => recognition.current?.stop()
  }, [])

  const start = useCallback((): void => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) {
      setUnavailableReason('Voice input is not available in this build — type instead')
      return
    }

    const instance = new Ctor()
    instance.lang = 'en-US'
    instance.continuous = false
    instance.interimResults = false

    instance.onresult = (event) => {
      const last = event.results[event.results.length - 1]
      const transcript = last?.[0]?.transcript
      if (transcript && last?.isFinal) onFinalTextRef.current(transcript.trim())
    }
    instance.onerror = (event) => {
      if (event.error === 'not-allowed') {
        setUnavailableReason('Microphone access was denied. Allow it and try again')
      } else if (event.error !== 'aborted') {
        setUnavailableReason('Voice input failed just now — type instead')
      }
    }
    instance.onend = () => setListening(false)

    recognition.current = instance
    try {
      instance.start()
      setListening(true)
      setUnavailableReason(null)
    } catch {
      setListening(false)
    }
  }, [])

  const stop = useCallback((): void => {
    recognition.current?.stop()
    setListening(false)
  }, [])

  return { listening, unavailableReason, start, stop }
}
