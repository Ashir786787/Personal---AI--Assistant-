import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'path'
import type { ChatMessage, ChatRole } from '@shared/chat'

export const MAX_CONTEXT_MESSAGES = 30
export const MAX_PERSISTED_MESSAGES = 200
export const MEMORY_FORMAT_VERSION = 2
const VALID_ROLES: ChatRole[] = ['user', 'assistant', 'tool']

interface PersistedMemory {
  version: number
  messages: ChatMessage[]
}

export class ConversationMemory {
  private messages: ChatMessage[] = []
  private nextId = 1
  private persistPath: string | null = null

  constructor(persistPath?: string) {
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
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'version' in parsed &&
        (parsed as PersistedMemory).version === MEMORY_FORMAT_VERSION &&
        Array.isArray((parsed as PersistedMemory).messages)
      ) {
        this.hydrate((parsed as PersistedMemory).messages)
      }
      // anything else (old-format or corrupt) is discarded — fresh start
    } catch {
      // corrupt memory file starts fresh rather than blocking the app
    }
  }

  private saveToDisk(): void {
    if (!this.persistPath) return
    try {
      mkdirSync(dirname(this.persistPath), { recursive: true })
      const payload: PersistedMemory = { version: MEMORY_FORMAT_VERSION, messages: this.messages }
      writeFileSync(this.persistPath, JSON.stringify(payload, null, 2))
    } catch {
      // best effort; conversation continues in RAM
    }
  }
}
