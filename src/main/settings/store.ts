import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'path'
import { app, safeStorage } from 'electron'
import type { ProviderId } from '@shared/providers'
import { envKey } from '../lib/env'

interface StoredKeys {
  gemini?: string
  groq?: string
  porcupine?: string
}

let cache: StoredKeys | null = null

function storePath(): string {
  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  return join(dir, 'keys.bin')
}

function readStore(): StoredKeys {
  if (cache) return cache
  const path = storePath()
  if (!existsSync(path) || !safeStorage.isEncryptionAvailable()) return {}
  try {
    const raw = Buffer.from(readFileSync(path, 'utf8'), 'base64')
    const decrypted = safeStorage.decryptString(raw)
    cache = JSON.parse(decrypted) as StoredKeys
    return cache
  } catch {
    return {}
  }
}

function writeStore(keys: StoredKeys): void {
  if (!safeStorage.isEncryptionAvailable()) return
  const encrypted = safeStorage.encryptString(JSON.stringify(keys))
  writeFileSync(storePath(), encrypted.toString('base64'))
  cache = keys
}

export function getApiKey(provider: ProviderId): string | undefined {
  const stored = readStore()[provider]
  if (stored) return stored
  const envName = provider === 'gemini' ? 'GEMINI_API_KEY' : 'GROQ_API_KEY'
  return envKey(envName)
}

export function setApiKey(provider: ProviderId, key: string): void {
  const keys = { ...readStore(), [provider]: key }
  writeStore(keys)
}

export function getWakeKey(): string | undefined {
  return readStore().porcupine
}

export function setWakeKey(key: string): void {
  const keys = { ...readStore(), porcupine: key }
  writeStore(keys)
}
