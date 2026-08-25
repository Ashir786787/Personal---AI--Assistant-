import { useCallback, useEffect, useRef, useState } from 'react'
import type { KaldiRecognizer, Model } from 'vosk-browser'
import { matchesWakePhrase, WAKE_PHRASES } from '../lib/wake-phrases'

export type WakeStatus =
  'off' | 'preparing' | 'downloading' | 'starting' | 'armed' | 'suspended' | 'error'

const ENABLED_KEY = 'ashirs.wake-enabled'
const SENSITIVITY_KEY = 'ashirs.wake-sensitivity'

export function isWakeEnabledStored(): boolean {
  return localStorage.getItem(ENABLED_KEY) === '1'
}

export function setWakeEnabledStored(next: boolean): void {
  localStorage.setItem(ENABLED_KEY, next ? '1' : '0')
}

function readTolerance(): number | undefined {
  const raw = Number(localStorage.getItem(SENSITIVITY_KEY))
  if (!Number.isFinite(raw)) return undefined
  if (raw >= 67) return 0
  if (raw >= 34) return undefined
  return 2
}

interface WakeOptions {
  enabled: boolean
  onWake: () => void
}

type Engine = {
  model: Model
  recognizer: KaldiRecognizer
  ctx: AudioContext
  node: ScriptProcessorNode
  source: MediaStreamAudioSourceNode
  mute: GainNode
  stream: MediaStream
}

interface WakeApi {
  status: WakeStatus
  error: string | null
  downloadPercent: number | null
  phrases: readonly string[]
  suspend: () => void
  resume: () => void
}

export function useWakeWord({ enabled, onWake }: WakeOptions): WakeApi {
  const [status, setStatus] = useState<WakeStatus>('off')
  const [error, setError] = useState<string | null>(null)
  const [downloadPercent, setDownloadPercent] = useState<number | null>(null)

  const engineRef = useRef<Engine | null>(null)
  const suspendedRef = useRef(false)
  const generationRef = useRef(0)
  const hooksRef = useRef(onWake)
  hooksRef.current = onWake
  const healthRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const teardown = useCallback((): void => {
    generationRef.current += 1
    if (healthRef.current) {
      clearInterval(healthRef.current)
      healthRef.current = null
    }
    const engine = engineRef.current
    engineRef.current = null
    if (!engine) return

    try {
      engine.source.disconnect()
      engine.node.disconnect()
      engine.mute.disconnect()
    } catch {
      // already torn down
    }
    engine.stream.getTracks().forEach((track) => track.stop())
    void engine.ctx.close().catch(() => undefined)
    try {
      engine.recognizer.remove()
    } catch {
      // already removed
    }
    try {
      engine.model.terminate()
    } catch {
      // already terminated
    }
  }, [])

  const startEngine = useCallback(async (): Promise<void> => {
    const generation = ++generationRef.current
    setError(null)
    setDownloadPercent(null)
    setStatus('preparing')

    const state = await window.ashirs.getWakeModelState()
    if (generation !== generationRef.current) return

    let modelUrl = state.state === 'ready' ? state.url : undefined

    if (!modelUrl) {
      setStatus('downloading')
      setDownloadPercent(state.percent ?? 0)

      const downloaded = await new Promise<string>((resolve, reject) => {
        const unsubscribe = window.ashirs.onWakeModelProgress((info) => {
          if (info.state === 'downloading') {
            setDownloadPercent(info.percent ?? 0)
            return
          }
          unsubscribe()
          if (info.state === 'ready' && info.url) resolve(info.url)
          else reject(new Error(info.error ?? 'Model download failed'))
        })
        void window.ashirs.startWakeModelDownload()
      }).catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Model download failed')
        setStatus('error')
        return null
      })

      if (generation !== generationRef.current) return
      if (!downloaded) return
      modelUrl = downloaded
    }

    setStatus('starting')

    const watchdog = window.setTimeout(() => {
      if (generation !== generationRef.current) return
      if (engineRef.current) return
      setError('The voice engine took too long to start — toggle off and on to retry')
      setStatus('error')
    }, 180_000)

    try {
      const vosk = await import('vosk-browser')
      if (generation !== generationRef.current) {
        window.clearTimeout(watchdog)
        return
      }

      const model = await vosk.createModel(modelUrl)
      if (generation !== generationRef.current) {
        window.clearTimeout(watchdog)
        model.terminate()
        return
      }

      const recognizer = new model.KaldiRecognizer(16000)
      let firedThisUtterance = false

      recognizer.on('partialresult', (message) => {
        if (suspendedRef.current || firedThisUtterance) return
        const result = (message as { result?: { partial?: string } }).result
        const partial = result?.partial ?? ''
        if (partial.trim().length === 0) return
        const hit = matchesWakePhrase(partial, { tolerance: readTolerance() })
        if (hit) {
          firedThisUtterance = true
          hooksRef.current()
        }
      })
      recognizer.on('result', () => {
        firedThisUtterance = false
      })

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
          sampleRate: 16000
        }
      })
      if (generation !== generationRef.current) {
        window.clearTimeout(watchdog)
        stream.getTracks().forEach((track) => track.stop())
        model.terminate()
        return
      }

      const ctx = new AudioContext({ sampleRate: 16000 })
      const node = ctx.createScriptProcessor(4096, 1, 1)
      const mute = ctx.createGain()
      mute.gain.value = 0
      node.onaudioprocess = (event) => {
        try {
          recognizer.acceptWaveform(event.inputBuffer)
        } catch {
          // dropped frame while tearing down
        }
      }
      const source = ctx.createMediaStreamSource(stream)
      source.connect(node)
      node.connect(mute)
      mute.connect(ctx.destination)

      engineRef.current = { model, recognizer, ctx, node, source, mute, stream }
      window.clearTimeout(watchdog)
      setStatus(suspendedRef.current ? 'suspended' : 'armed')

      if (healthRef.current) clearInterval(healthRef.current)
      healthRef.current = window.setInterval(() => {
        if (generation !== generationRef.current) {
          if (healthRef.current) {
            clearInterval(healthRef.current)
            healthRef.current = null
          }
          return
        }
        if (suspendedRef.current) return
        if (!engineRef.current) {
          console.warn('[wake] health check: engine gone, restarting')
          if (healthRef.current) {
            clearInterval(healthRef.current)
            healthRef.current = null
          }
          void startEngine()
          return
        }
        const eng = engineRef.current
        if (
          eng.ctx.state === 'closed' ||
          eng.stream.getTracks().every((t) => t.readyState === 'ended')
        ) {
          console.warn('[wake] health check: audio dead, restarting engine')
          if (healthRef.current) {
            clearInterval(healthRef.current)
            healthRef.current = null
          }
          teardown()
          void startEngine()
        } else if (eng.ctx.state === 'suspended') {
          console.info('[wake] health check: AudioContext suspended, resuming')
          void eng.ctx.resume()
        }
      }, 30_000)
    } catch (err) {
      window.clearTimeout(watchdog)
      if (generation !== generationRef.current) return
      const message = err instanceof Error ? err.message : 'Wake-word engine failed to start'
      setError(message)
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    if (enabled) {
      void startEngine()
    } else {
      teardown()
      setStatus('off')
      setError(null)
      setDownloadPercent(null)
    }
    return () => teardown()
  }, [enabled, startEngine, teardown])

  const suspend = useCallback((): void => {
    suspendedRef.current = true
    const engine = engineRef.current
    if (engine) {
      try {
        engine.source.disconnect()
      } catch {
        // already disconnected
      }
    }
    if (engineRef.current) setStatus('suspended')
  }, [])

  const resume = useCallback((): void => {
    suspendedRef.current = false
    const engine = engineRef.current
    if (engine) {
      try {
        engine.source.connect(engine.node)
      } catch {
        // already connected
      }
    }
    if (engineRef.current) setStatus('armed')
  }, [])

  return { status, error, downloadPercent, phrases: WAKE_PHRASES, suspend, resume }
}
