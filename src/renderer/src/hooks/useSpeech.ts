import { useCallback, useEffect, useRef, useState } from 'react'
import { hasUrduScript, MAX_SPEECH_CHARS, SPEECH_RATE, speechText } from '../lib/speechText'

let cachedVoices: SpeechSynthesisVoice[] = []
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  const prime = (): void => {
    cachedVoices = window.speechSynthesis.getVoices()
  }
  prime()
  window.speechSynthesis.addEventListener('voiceschanged', prime)
}

function pickVoice(text: string): SpeechSynthesisVoice | null {
  const want = hasUrduScript(text) ? 'ur' : 'en'
  const voices = cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices()
  return (
    voices.find((voice) => voice.lang.startsWith(want)) ??
    voices.find((voice) => voice.lang.startsWith(want === 'ur' ? 'en' : 'ur')) ??
    null
  )
}

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

  const speak = useCallback((input: string): void => {
    if (!enabledRef.current || !('speechSynthesis' in window)) return
    const text = speechText(input, MAX_SPEECH_CHARS)
    if (text.length === 0) return
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = SPEECH_RATE
    utterance.pitch = 1
    const voice = pickVoice(text)
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
