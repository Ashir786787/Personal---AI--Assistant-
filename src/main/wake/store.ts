import { createHash } from 'node:crypto'
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync
} from 'node:fs'
import { PassThrough, Readable } from 'node:stream'
import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web'
import { dirname, join } from 'path'
import { app, net } from 'electron'
import { pipeline } from 'node:stream/promises'
import { log } from '../lib/logger'

const MODEL_RELEASE_BASE =
  'https://github.com/Ashir786787/Personal---AI--Assistant-/releases/download'
const MODEL_TAG = 'v1.4.0'
export const MODEL_FILE_NAME = 'wake-model-en-v1.tar.gz'

// SHA-256 of the packaged model archive — pinned at build time
export const MODEL_SHA256 = '14195edcc6deeaf12f264961f6226407b6f619c52fea167aed9da881841133de'

export interface WakeModelInternalState {
  state: 'missing' | 'downloading' | 'ready' | 'error'
  percent?: number
  error?: string
  url?: string
}

let current: WakeModelInternalState = { state: 'missing' }
let inFlight = false
const listeners = new Set<(info: WakeModelInternalState) => void>()

function modelDir(): string {
  return join(app.getPath('userData'), 'wake')
}

export function modelFilePath(): string {
  return join(modelDir(), MODEL_FILE_NAME)
}

export function modelUrl(): string {
  return 'vosk-model://local/model.tar.gz'
}

function setState(next: WakeModelInternalState): void {
  current = next
  for (const listener of listeners) listener(next)
}

export function onWakeModelState(listener: (info: WakeModelInternalState) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function sizeOk(): boolean {
  try {
    return statSync(modelFilePath()).size > 1_000_000
  } catch {
    return false
  }
}

function sha256(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(path)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

export function getWakeState(): WakeModelInternalState {
  if (current.state === 'ready') return current
  if (current.state !== 'error' && sizeOk()) {
    current = { state: 'ready', url: modelUrl() }
  }
  return current
}

let cachedWorkerScript: string | null = null

/**
 * Loads the extracted vosk Web Worker source emitted by scripts/patch-vosk.cjs
 * at install time (node_modules/vosk-browser/dist/ashirs-kaldi-worker.js).
 * Served over vosk-worker:// so it can carry its own worker-scoped CSP
 * (Emscripten's embind layer needs dynamic code compilation inside this
 * isolated worker; the renderer page stays strict). Reads are asar-transparent.
 */
export function loadVoskWorkerSource(): string {
  if (cachedWorkerScript) return cachedWorkerScript
  const workerPath = join(__dirname, '../../node_modules/vosk-browser/dist/ashirs-kaldi-worker.js')
  const source = readFileSync(workerPath, 'utf8')
  log('info', 'wake', `vosk worker source loaded (${Math.round(source.length / 1_000_000)} MB)`)
  cachedWorkerScript = source
  return source
}

export async function startWakeModelDownload(): Promise<void> {
  if (inFlight) return
  if (sizeOk()) {
    setState({ state: 'ready', url: modelUrl() })
    return
  }
  inFlight = true
  setState({ state: 'downloading', percent: 0 })

  const url = `${MODEL_RELEASE_BASE}/${MODEL_TAG}/${MODEL_FILE_NAME}`
  const tmpPath = `${modelFilePath()}.part`

  try {
    mkdirSync(dirname(tmpPath), { recursive: true })
    const response = await net.fetch(url, { redirect: 'follow' })
    if (!response.ok || !response.body) {
      throw new Error(`model download failed with HTTP ${response.status}`)
    }

    const totalHeader = Number(response.headers.get('content-length') ?? '0')
    let received = 0
    let lastPercent = -1

    const counter = new PassThrough()
    counter.on('data', (chunk: Buffer) => {
      received += chunk.length
      if (totalHeader > 0) {
        const percent = Math.min(99, Math.round((received / totalHeader) * 100))
        if (percent !== lastPercent) {
          lastPercent = percent
          setState({ state: 'downloading', percent })
        }
      }
    })

    await pipeline(
      Readable.fromWeb(response.body as NodeWebReadableStream<Uint8Array>),
      counter,
      createWriteStream(tmpPath)
    )

    const actualSha = await sha256(tmpPath)
    if (actualSha !== MODEL_SHA256) {
      unlinkSync(tmpPath)
      throw new Error('model checksum mismatch — download discarded')
    }

    renameSync(tmpPath, modelFilePath())
    log(
      'info',
      'wake',
      `model ready (${Math.round(statSync(modelFilePath()).size / 1_000_000)} MB)`
    )
    setState({ state: 'ready', percent: 100, url: modelUrl() })
  } catch (err) {
    try {
      if (existsSync(tmpPath)) unlinkSync(tmpPath)
    } catch {
      // nothing to clean
    }
    const message = err instanceof Error ? err.message : 'model download failed'
    log('warn', 'wake', message)
    setState({ state: 'error', error: message })
  } finally {
    inFlight = false
  }
}
