import { useCallback } from 'react'

export function useSpeech(enabled: boolean): { speak: (text: string) => void; stop: () => void } {
  const stop = useCallback((): void => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  }, [])

  const speak = useCallback(
    (text: string): void => {
      if (!enabled || !('speechSynthesis' in window)) return
      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1.02
      utterance.pitch = 1
      const [voice] = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en'))
      if (voice) utterance.voice = voice

      window.speechSynthesis.speak(utterance)
    },
    [enabled]
  )

  return { speak, stop }
}
