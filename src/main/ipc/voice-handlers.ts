import { ipcMain, type WebContents } from 'electron'
import { IPC } from '@shared/ipc'
import type { VoiceRecording } from '@shared/ipc'
import { getApiKey } from '../settings/store'
import { log } from '../lib/logger'

const TRANSCRIBE_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const MODEL = 'whisper-large-v3-turbo'
const MAX_AUDIO_BYTES = 15 * 1024 * 1024
const TIMEOUT_MS = 30_000

export function registerVoiceIpc(_webContents: WebContents): void {
  ipcMain.handle(IPC.voiceTranscribe, async (_event, raw: unknown): Promise<string> => {
    if (typeof raw !== 'object' || raw === null) throw new Error('Malformed recording')
    const recording = raw as VoiceRecording
    if (!(recording.data instanceof ArrayBuffer)) throw new Error('Malformed recording')
    if (recording.data.byteLength === 0) throw new Error('The recording was empty')
    if (recording.data.byteLength > MAX_AUDIO_BYTES) {
      throw new Error('That recording is too large to process')
    }

    const apiKey = getApiKey('groq')
    if (!apiKey) throw new Error('No Groq API key configured for voice input')

    const form = new FormData()
    form.append('file', new Blob([recording.data], { type: recording.mime }), 'speech.webm')
    form.append('model', MODEL)
    form.append('temperature', '0')

    const response = await fetch(TRANSCRIBE_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })

    if (!response.ok) {
      log('warn', 'voice', `transcription failed: ${response.status}`)
      if (response.status === 429) {
        throw new Error('Voice service hit its free limit. Try again in a minute')
      }
      throw new Error(`Transcription failed (${response.status}). Type your message instead`)
    }

    const result = (await response.json()) as { text?: string }
    const text = (result.text ?? '').trim()
    log('info', 'voice', `transcribed ${recording.data.byteLength} bytes → ${text.length} chars`)
    return text
  })
}
