import { useCallback, useEffect, useRef, useState } from 'react'

interface RecorderState {
  recording: boolean
  level: number
  error: string | null
}

interface RecorderHooks {
  onFinal: (text: string) => void
  onInterim: (text: string) => void
}

const INTERIM_INTERVAL_MS = 3000
const MIN_INTERIM_BYTES = 4096
const MIN_FINAL_BYTES = 2048

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm'
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus'
  return 'audio/webm'
}

export function useVoiceRecorder(hooks: RecorderHooks): RecorderState & { toggle: () => void } {
  const [state, setState] = useState<RecorderState>({ recording: false, level: 0, error: null })
  const streamRef = useRef<MediaStream | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const rafRef = useRef(0)
  const hooksRef = useRef(hooks)
  hooksRef.current = hooks

  const teardown = useCallback((): void => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    void ctxRef.current?.close()
    streamRef.current = null
    ctxRef.current = null
    recorderRef.current = null
    setState((prev) => ({ ...prev, recording: false, level: 0 }))
  }, [])

  useEffect(() => teardown, [teardown])

  const start = useCallback(async (): Promise<void> => {
    setState({ recording: false, level: 0, error: null })

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setState({
        recording: false,
        level: 0,
        error: 'Microphone access was denied. Allow it in Windows settings and try again'
      })
      return
    }
    streamRef.current = stream

    if (typeof MediaRecorder === 'undefined') {
      teardown()
      setState({
        recording: false,
        level: 0,
        error: 'Audio recording is not supported in this build'
      })
      return
    }

    const ctx = new AudioContext()
    ctxRef.current = ctx
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    ctx.createMediaStreamSource(stream).connect(analyser)

    const data = new Uint8Array(analyser.frequencyBinCount)
    const tick = (): void => {
      analyser.getByteTimeDomainData(data)
      let sum = 0
      for (let i = 0; i < data.length; i++) {
        const deviation = (data[i]! - 128) / 128
        sum += deviation * deviation
      }
      setState((prev) =>
        prev.recording ? { ...prev, level: Math.min(1, Math.sqrt(sum / data.length) * 3.5) } : prev
      )
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    const mimeType = pickMimeType()
    const chunks: Blob[] = []
    let finished = false
    let interimInFlight = false

    const transcribeSnapshot = async (): Promise<string> => {
      const blob = new Blob(chunks, { type: mimeType })
      const audio = await blob.arrayBuffer()
      return window.ashirs.transcribeVoice({ data: audio, mime: mimeType })
    }

    const interimTimer = setInterval(() => {
      if (finished || interimInFlight) return
      const totalBytes = chunks.reduce((n, c) => n + c.size, 0)
      if (totalBytes < MIN_INTERIM_BYTES) return

      interimInFlight = true
      void transcribeSnapshot()
        .then((text) => {
          const trimmed = text.trim()
          if (!finished && trimmed.length > 0) hooksRef.current.onInterim(trimmed)
        })
        .catch(() => {
          // interim failures stay invisible; the final pass decides
        })
        .finally(() => {
          interimInFlight = false
        })
    }, INTERIM_INTERVAL_MS)

    const recorder = new MediaRecorder(stream, { mimeType })

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }

    recorder.onstop = async () => {
      finished = true
      clearInterval(interimTimer)
      const blob = new Blob(chunks, { type: mimeType })
      teardown()

      if (blob.size < MIN_FINAL_BYTES) {
        setState({
          recording: false,
          level: 0,
          error: 'That came out as silence — hold the mic button while you speak'
        })
        return
      }

      try {
        const audio = await blob.arrayBuffer()
        const text = await window.ashirs.transcribeVoice({ data: audio, mime: mimeType })
        const trimmed = text.trim()
        if (trimmed.length === 0) {
          setState({
            recording: false,
            level: 0,
            error: 'I could not make out any words — try again a little closer to the mic'
          })
          return
        }
        setState({ recording: false, level: 0, error: null })
        hooksRef.current.onFinal(trimmed)
      } catch (err) {
        setState({
          recording: false,
          level: 0,
          error: err instanceof Error ? err.message : 'Transcription failed unexpectedly'
        })
      }
    }

    recorderRef.current = recorder
    recorder.start()
    setState({ recording: true, level: 0, error: null })
  }, [teardown])

  const toggle = useCallback((): void => {
    if (state.recording && recorderRef.current) {
      recorderRef.current.stop()
      return
    }
    void start()
  }, [start, state.recording])

  return { ...state, toggle }
}
