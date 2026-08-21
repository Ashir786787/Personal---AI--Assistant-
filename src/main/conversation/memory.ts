import type { ChatMessage, ChatRole } from '@shared/chat'

export const MAX_CONTEXT_MESSAGES = 20

export class ConversationMemory {
  private messages: ChatMessage[] = []
  private nextId = 1

  append(role: ChatRole, content: string): ChatMessage {
    const message: ChatMessage = {
      id: `msg-${this.nextId++}`,
      role,
      content,
      createdAt: Date.now()
    }
    this.messages.push(message)
    return message
  }

  recent(limit = MAX_CONTEXT_MESSAGES): ChatMessage[] {
    return this.messages.slice(-limit)
  }

  clear(): void {
    this.messages = []
  }

  get size(): number {
    return this.messages.length
  }
}
