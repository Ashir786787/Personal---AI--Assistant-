import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'path'
import { afterAll, describe, expect, it } from 'vitest'
import { ConversationMemory, MAX_PERSISTED_MESSAGES } from '../../src/main/conversation/memory'

let dir = ''

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('conversation memory persistence', () => {
  it('restores the full conversation across restarts', () => {
    dir = mkdtempSync(join(tmpdir(), 'ashirs-memory-'))
    const file = join(dir, 'memory.json')

    const first = new ConversationMemory(file)
    first.append('user', 'where is vanguard?')
    first.append('assistant', 'Found in Downloads.')

    const second = new ConversationMemory(file)
    expect(second.size).toBe(2)
    expect(second.recent()[0]!.content).toBe('where is vanguard?')
    expect(second.recent()[1]!.role).toBe('assistant')
  })

  it('continues id numbering after restore so no ids collide', () => {
    const file = join(dir, 'ids.json')
    new ConversationMemory(file).append('user', 'hello')
    const restored = new ConversationMemory(file)
    const next = restored.append('tool', 'TOOL_RESULT')
    expect(next.id).toBe('msg-2')
  })

  it('caps the persisted history and keeps the newest messages', () => {
    const file = join(dir, 'cap.json')
    const memory = new ConversationMemory(file)
    for (let i = 0; i < MAX_PERSISTED_MESSAGES + 25; i++) {
      memory.append('user', `message ${i}`)
    }
    const raw = JSON.parse(readFileSync(file, 'utf8')) as Array<{ content: string }>
    expect(raw).toHaveLength(MAX_PERSISTED_MESSAGES)
    expect(raw[raw.length - 1]!.content).toBe(`message ${MAX_PERSISTED_MESSAGES + 24}`)
  })

  it('drops corrupt or invalid history instead of failing', () => {
    const file = join(dir, 'corrupt.json')
    writeFileSync(file, '{{{nope')
    expect(new ConversationMemory(file).size).toBe(0)

    const junkFile = join(dir, 'junk.json')
    writeFileSync(
      junkFile,
      JSON.stringify([{ id: 'msg-1', role: 'hacker', content: 'injected' }, { broken: true }])
    )
    expect(new ConversationMemory(junkFile).size).toBe(0)
  })

  it('clear wipes the file so restarts start clean', () => {
    const file = join(dir, 'clear.json')
    const memory = new ConversationMemory(file)
    memory.append('user', 'forget me')
    memory.clear()
    expect(existsSync(file)).toBe(true)
    expect(new ConversationMemory(file).size).toBe(0)
  })
})
