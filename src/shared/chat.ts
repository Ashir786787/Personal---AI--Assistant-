import type { ProviderId } from './providers'
import type { AgentId } from './agents'

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
  | { type: 'cancelled' }
  | { type: 'reset' }

export interface SendChatRequest {
  text: string
  agentId?: AgentId
}

export interface SendChatResponse {
  userMessageId: string
}
