import { useCallback, useEffect, useRef, useState } from 'react'

export type WakeStatus = 'off' | 'no-key' | 'starting' | 'armed' | 'suspended' | 'error'

const ENABLED_KEY = 'ashirs.wake-enabled'
const SENSITIVITY_KEY = 'ashirs.wake-sensitivity'
const KEYWORD_LABEL = 'jarvis'

export function isWakeEnabledStored(): boolean {
  return localStorage.getItem(ENABLED_KEY) === '1'
}

export function setWakeEnabledStored(next: boolean): void {
  localStorage.setItem(ENABLED_KEY, next ? '1' : '0')
}

function readSensitivity(): number {
  const raw = Number(localStorage.getItem(SENSITIVITY_KEY))
  if (!Number.isFinite(raw)) return 0.75
  return Math.min(1, Math.max(0, raw))
}

interface PvDetection {
  label?: string
}

interface PvWorkerLike {
  stop(): Promise<void>
  release(): Promise<void>
}

interface PvCreateArgs {
  accessKey: string
  keyword: unknown
  detectionCallback: (detection: PvDetection) => void
  errorCallback: (error: Error) => void
}

interface PvModuleLike {
  PorcupineWorker: { create(args: PvCreateArgs): Promise<PvWorkerLike> }
}

interface VpModuleLike {
  WebVoiceProcessor: {
    subscribe(engine: unknown): Promise<void>
    unsubscribe(engine: unknown): void
  }
}

interface WakeOptions {
  enabled: boolean
  onWake: () => void
}

interface WakeApi {
  status: WakeStatus
  error: string | null
  keywordLabel: string
  suspend: () => void
  resume: () => void
}

export function useWakeWord({ enabled, onWake }: WakeOptions): WakeApi {
  const [status, setStatus] = useState<WakeStatus>('off')
  const [error, setError] = useState<string | null>(null)

  const engineRef = useRef<PvWorkerLike | null>(null)
  const subscribedRef = useRef(false)
  const suspendedRef = useRef(false)
  const generationRef = useRef(0)
  const hooksRef = useRef(onWake)
  hooksRef.current = onWake

  const stopEngine = useCallback(async (): Promise<void> => {
    generationRef.current += 1
    const engine = engineRef.current
    engineRef.current = null
    if (engine && subscribedRef.current) {
      try {
        const vp = (await import('@picovoice/web-voice-processor')) as unknown as VpModuleLike
        vp.WebVoiceProcessor.unsubscribe(engine)
      } catch {
        // engine already gone
      }
    }
    subscribedRef.current = false
    if (engine) {
      try {
        await engine.stop()
        await engine.release()
      } catch {
        // best effort teardown
      }
    }
  }, [])

  const startEngine = useCallback(async (): Promise<void> => {
    const generation = ++generationRef.current
    setError(null)
    setStatus('starting')

    let key: string | null = null
    try {
      key = await window.ashirs.getWakeKey()
    } catch {
      key = null
    }
    if (!key) {
      setStatus('no-key')
      return
    }

    try {
      const [pv, vp] = (await Promise.all([
        import('@picovoice/porcupine-web'),
        import('@picovoice/web-voice-processor')
      ])) as unknown as [PvModuleLike, VpModuleLike]

      if (generation !== generationRef.current) {
        return
      }

      const engine = await pv.PorcupineWorker.create({
        accessKey: key,
        keyword: { builtinKeyword: KEYWORD_LABEL, sensitivity: readSensitivity() },
        detectionCallback: (detection) => {
          if (suspendedRef.current) return
          if ((detection.label ?? '').length > 0 || detection.label === undefined) {
            hooksRef.current()
          }
        },
        errorCallback: (err) => {
          setError(err.message)
          setStatus('error')
        }
      })

      if (generation !== generationRef.current) {
        void engine
          .stop()
          .then(() => engine.release())
          .catch(() => undefined)
        return
      }

      engineRef.current = engine
      await vp.WebVoiceProcessor.subscribe(engine)
      subscribedRef.current = true

      if (generation !== generationRef.current) return
      setStatus(suspendedRef.current ? 'suspended' : 'armed')
    } catch (err) {
      if (generation !== generationRef.current) return
      const message = err instanceof Error ? err.message : 'Wake-word engine failed to start'
      setError(message)
      setStatus(message.toLowerCase().includes('key') ? 'no-key' : 'error')
    }
  }, [])

  useEffect(() => {
    if (enabled) {
      void startEngine()
    } else {
      void stopEngine().then(() => {
        setStatus('off')
        setError(null)
      })
    }
    return () => {
      void stopEngine()
    }
  }, [enabled, startEngine, stopEngine])

  const suspend = useCallback((): void => {
    suspendedRef.current = true
    if (engineRef.current) setStatus('suspended')
  }, [])

  const resume = useCallback((): void => {
    suspendedRef.current = false
    if (engineRef.current) setStatus('armed')
  }, [])

  return { status, error, keywordLabel: KEYWORD_LABEL, suspend, resume }
}
