import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  ConversationMemory,
  MAX_PERSISTED_MESSAGES,
  type MemoryCipher
} from '../../src/main/conversation/memory'

let dir = ''

const PREFIX = 'test:v1:'

function fakeCipher(): MemoryCipher {
  return {
    encrypt(plain: string): string {
      return PREFIX + Buffer.from(plain, 'utf8').toString('base64')
    },
    decrypt(blob: string): string | null {
      if (!blob.startsWith(PREFIX)) return null
      try {
        return Buffer.from(blob.slice(PREFIX.length), 'base64').toString('utf8')
      } catch {
        return null
      }
    }
  }
}

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('conversation memory persistence (encrypted at rest)', () => {
  it('restores the full conversation across restarts', () => {
    dir = mkdtempSync(join(tmpdir(), 'ashirs-memory-'))
    const file = join(dir, 'memory.json')

    const first = new ConversationMemory(file, fakeCipher())
    first.append('user', 'where is vanguard?')
    first.append('assistant', 'Found in Downloads.')

    const second = new ConversationMemory(file, fakeCipher())
    expect(second.size).toBe(2)
    expect(second.recent()[0]!.content).toBe('where is vanguard?')
    expect(second.recent()[1]!.role).toBe('assistant')
  })

  it('stores only ciphertext on disk — plaintext never touches the drive', () => {
    const file = join(dir, 'ciphertext-only.json')
    new ConversationMemory(file, fakeCipher()).append('user', 'my secret project name')
    const raw = readFileSync(file, 'utf8')
    expect(raw).not.toContain('my secret project name')
    expect(raw).toContain('test:v1:')
  })

  it('refuses to persist when encryption is unavailable and keeps working in RAM', () => {
    const file = join(dir, 'no-encryption.json')
    const broken: MemoryCipher = {
      encrypt: () => null,
      decrypt: () => null
    }
    const memory = new ConversationMemory(file, broken)
    memory.append('user', 'ram only session')
    expect(existsSync(file)).toBe(false)
    expect(memory.size).toBe(1)
  })

  it('continues id numbering after restore so no ids collide', () => {
    const file = join(dir, 'ids.json')
    new ConversationMemory(file, fakeCipher()).append('user', 'hello')
    const restored = new ConversationMemory(file, fakeCipher())
    const next = restored.append('tool', 'TOOL_RESULT')
    expect(next.id).toBe('msg-2')
  })

  it('caps the persisted history and keeps the newest messages', () => {
    const file = join(dir, 'cap.json')
    const memory = new ConversationMemory(file, fakeCipher())
    for (let i = 0; i < MAX_PERSISTED_MESSAGES + 25; i++) {
      memory.append('user', `message ${i}`)
    }
    const envelope = JSON.parse(readFileSync(file, 'utf8')) as { payload?: string }
    const inner = JSON.parse(
      Buffer.from(envelope.payload!.replace('test:v1:', ''), 'base64').toString('utf8')
    ) as { messages: Array<{ content: string }> }
    expect(inner.messages).toHaveLength(MAX_PERSISTED_MESSAGES)
    expect(inner.messages[inner.messages.length - 1]!.content).toBe(
      `message ${MAX_PERSISTED_MESSAGES + 24}`
    )
  })

  it('discards history written in an older format version', () => {
    const file = join(dir, 'old-version.json')
    writeFileSync(
      file,
      JSON.stringify([
        {
          id: 'msg-1',
          role: 'assistant',
          content: 'A confirmation dialog is still waiting for you to click Allow',
          createdAt: 1
        }
      ])
    )
    expect(new ConversationMemory(file, fakeCipher()).size).toBe(0)
  })

  it('drops corrupt ciphertext instead of failing', () => {
    const file = join(dir, 'corrupt-blob.json')
    const envelope = JSON.stringify({ version: 3, payload: 'not-a-valid-blob' })
    writeFileSync(file, envelope)
    expect(new ConversationMemory(file, fakeCipher()).size).toBe(0)

    const junkFile = join(dir, 'junk.json')
    writeFileSync(junkFile, '{{{nope')
    expect(new ConversationMemory(junkFile, fakeCipher()).size).toBe(0)
  })

  it('clear wipes the file so restarts start clean', () => {
    const file = join(dir, 'clear.json')
    const memory = new ConversationMemory(file, fakeCipher())
    memory.append('user', 'forget me')
    memory.clear()
    expect(existsSync(file)).toBe(true)
    expect(new ConversationMemory(file, fakeCipher()).size).toBe(0)
  })
})
