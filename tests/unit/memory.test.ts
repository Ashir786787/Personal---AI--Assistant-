import { describe, expect, it } from 'vitest'
import { ConversationMemory, MAX_CONTEXT_MESSAGES } from '../../src/main/conversation/memory'

describe('ConversationMemory', () => {
  it('appends messages with sequential ids', () => {
    const memory = new ConversationMemory()
    const first = memory.append('user', 'hello')
    const second = memory.append('assistant', 'hi Ashir')

    expect(first.id).not.toBe(second.id)
    expect(first.role).toBe('user')
    expect(second.content).toBe('hi Ashir')
    expect(memory.size).toBe(2)
  })

  it('recent returns the trailing window of the conversation', () => {
    const memory = new ConversationMemory()
    for (let i = 0; i < 10; i++) {
      memory.append('user', `message ${i}`)
    }

    const recent = memory.recent(3)
    expect(recent).toHaveLength(3)
    expect(recent[0]?.content).toBe('message 7')
    expect(recent[2]?.content).toBe('message 9')
  })

  it('caps context at MAX_CONTEXT_MESSAGES by default', () => {
    const memory = new ConversationMemory()
    for (let i = 0; i < MAX_CONTEXT_MESSAGES + 15; i++) {
      memory.append('user', `message ${i}`)
    }

    expect(memory.size).toBe(MAX_CONTEXT_MESSAGES + 15)
    expect(memory.recent()).toHaveLength(MAX_CONTEXT_MESSAGES)
  })

  it('clear wipes history but keeps accepting new messages', () => {
    const memory = new ConversationMemory()
    memory.append('user', 'old')
    memory.clear()

    expect(memory.size).toBe(0)
    const fresh = memory.append('assistant', 'new')
    expect(fresh.content).toBe('new')
  })
})
