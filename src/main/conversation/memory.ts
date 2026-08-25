import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'path'
import type { ChatMessage, ChatRole } from '@shared/chat'

export const MAX_CONTEXT_MESSAGES = 10
export const MAX_PERSISTED_MESSAGES = 200
export const MEMORY_FORMAT_VERSION = 3
const VALID_ROLES: ChatRole[] = ['user', 'assistant', 'tool']

export interface MemoryCipher {
  encrypt(plain: string): string | null
  decrypt(blob: string): string | null
}

interface PersistedEnvelope {
  version: number
  payload?: string
}

interface PersistedMessages {
  version: number
  messages: ChatMessage[]
}

export class ConversationMemory {
  private messages: ChatMessage[] = []
  private nextId = 1
  private persistPath: string | null = null
  private cipher: MemoryCipher | null = null
  private warnedUnencrypted = false

  constructor(persistPath?: string, cipher?: MemoryCipher) {
    this.cipher = cipher ?? null
    if (persistPath) {
      this.persistPath = persistPath
      this.loadFromDisk()
    }
  }

  append(role: ChatRole, content: string): ChatMessage {
    const message: ChatMessage = {
      id: `msg-${this.nextId++}`,
      role,
      content,
      createdAt: Date.now()
    }
    this.messages.push(message)
    if (this.messages.length > MAX_PERSISTED_MESSAGES) {
      this.messages = this.messages.slice(-MAX_PERSISTED_MESSAGES)
    }
    this.saveToDisk()
    return message
  }

  recent(limit = MAX_CONTEXT_MESSAGES): ChatMessage[] {
    return this.messages.slice(-limit)
  }

  clear(): void {
    this.messages = []
    this.saveToDisk()
  }

  get size(): number {
    return this.messages.length
  }

  hydrate(messages: ChatMessage[]): void {
    const cleaned = messages.filter(
      (message) => VALID_ROLES.includes(message.role) && typeof message.content === 'string'
    )
    const maxId = cleaned.reduce((max, message) => {
      const numeric = Number(String(message.id).replace('msg-', ''))
      return Number.isFinite(numeric) ? Math.max(max, numeric) : max
    }, 0)
    this.messages = cleaned.slice(-MAX_PERSISTED_MESSAGES)
    this.nextId = maxId + 1
  }

  private loadFromDisk(): void {
    if (!this.persistPath) return
    try {
      if (!existsSync(this.persistPath)) return
      const parsed = JSON.parse(readFileSync(this.persistPath, 'utf8')) as unknown
      let inner: unknown = null

      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        (parsed as PersistedEnvelope).version === MEMORY_FORMAT_VERSION &&
        typeof (parsed as PersistedEnvelope).payload === 'string'
      ) {
        if (!this.cipher) return
        const decrypted = this.cipher.decrypt((parsed as PersistedEnvelope).payload as string)
        if (!decrypted) return
        inner = JSON.parse(decrypted) as unknown
      } else if (
        typeof parsed === 'object' &&
        parsed !== null &&
        (parsed as PersistedMessages).version === MEMORY_FORMAT_VERSION &&
        Array.isArray((parsed as PersistedMessages).messages)
      ) {
        inner = parsed
      }

      if (
        typeof inner === 'object' &&
        inner !== null &&
        Array.isArray((inner as PersistedMessages).messages)
      ) {
        this.hydrate((inner as PersistedMessages).messages)
      }
      // anything else (old plaintext format, foreign ciphertext or corrupt data) is discarded
    } catch {
      // corrupt memory file starts fresh rather than blocking the app
    }
  }

  private saveToDisk(): void {
    if (!this.persistPath) return
    try {
      mkdirSync(dirname(this.persistPath), { recursive: true })
      const inner: PersistedMessages = { version: MEMORY_FORMAT_VERSION, messages: this.messages }

      let file: string
      if (this.cipher) {
        const blob = this.cipher.encrypt(JSON.stringify(inner))
        if (!blob) {
          if (!this.warnedUnencrypted) {
            this.warnedUnencrypted = true
            console.error('[memory] disk encryption unavailable — conversation kept in RAM only')
          }
          return
        }
        const envelope: PersistedEnvelope = { version: MEMORY_FORMAT_VERSION, payload: blob }
        file = JSON.stringify(envelope)
      } else {
        file = JSON.stringify(inner)
      }

      writeFileSync(this.persistPath, file)
    } catch {
      // best effort; conversation continues in RAM
    }
  }
}
