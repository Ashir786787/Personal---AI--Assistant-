import { useCallback, useEffect, useRef, useState } from 'react'

export function useSpeech(enabled: boolean): {
  speak: (text: string) => void
  stop: () => void
  speaking: boolean
} {
  const [speaking, setSpeaking] = useState(false)
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  const stop = useCallback((): void => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
    }
  }, [])

  const speak = useCallback((text: string): void => {
    if (!enabledRef.current || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1.06
    utterance.pitch = 1
    const [voice] = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en'))
    if (voice) utterance.voice = voice
    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)

    window.speechSynthesis.speak(utterance)
  }, [])

  useEffect(
    () => () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    },
    []
  )

  return { speak, stop, speaking }
}
