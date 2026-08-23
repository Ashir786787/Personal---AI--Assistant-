import type { ProviderId } from './providers'

export type ChatRole = 'user' | 'assistant' | 'system' | 'tool'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  createdAt: number
}

export type StreamEvent =
  | { type: 'start'; provider: ProviderId; model: string }
  | { type: 'delta'; text: string }
  | { type: 'tool'; name: string; argsSummary: string }
  | { type: 'done'; provider: ProviderId; model: string }
  | { type: 'error'; message: string; recoverable: boolean }
  | { type: 'reset' }

export interface SendChatRequest {
  text: string
}

export interface SendChatResponse {
  userMessageId: string
}
