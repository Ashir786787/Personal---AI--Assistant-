import { useEffect, useState } from 'react'

export function useAudioLevel(active: boolean): number {
  const [level, setLevel] = useState(0)

  useEffect(() => {
    if (!active) {
      setLevel(0)
      return
    }

    let raf = 0
    let cancelled = false
    let ctx: AudioContext | null = null
    let micStream: MediaStream | null = null

    const run = async (): Promise<void> => {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (cancelled) return

        ctx = new AudioContext()
        const source = ctx.createMediaStreamSource(micStream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 512
        source.connect(analyser)

        const data = new Uint8Array(analyser.frequencyBinCount)
        const tick = (): void => {
          analyser.getByteTimeDomainData(data)
          let sum = 0
          for (let i = 0; i < data.length; i++) {
            const deviation = (data[i]! - 128) / 128
            sum += deviation * deviation
          }
          setLevel(Math.min(1, Math.sqrt(sum / data.length) * 3.5))
          raf = requestAnimationFrame(tick)
        }
        tick()
      } catch {
        setLevel(0)
      }
    }

    void run()

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      micStream?.getTracks().forEach((track) => track.stop())
      void ctx?.close()
    }
  }, [active])

  return level
}
