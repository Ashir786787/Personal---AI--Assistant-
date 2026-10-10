import type { ProviderId } from './providers'
import type { AgentId } from './agents'

export type ChatRole = 'user' | 'assistant' | 'system' | 'tool'

/** One source of truth for the composer cap: the renderer counts against it and main enforces it. */
export const MAX_CHAT_INPUT_LENGTH = 8000

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  createdAt: number
}

/** Tool lifecycle states from docs/UI-SPEC.md 4.3. */
export type ToolStatus =
  'queued' | 'awaiting_approval' | 'running' | 'done' | 'failed' | 'cancelled'

export type StreamEvent =
  | { type: 'turnStart'; turnId: string; startedAt: number }
  | { type: 'start'; provider: ProviderId; model: string }
  | { type: 'delta'; text: string }
  | { type: 'tool'; toolId: string; name: string; argsSummary: string }
  | { type: 'toolStatus'; toolId: string; status: ToolStatus; detail?: string }
  | { type: 'toolDone'; toolId: string; name: string; summary?: string }
  | { type: 'toolFailed'; toolId: string; name: string; message: string }
  | { type: 'agent'; agentId: AgentId; name: string; state: 'start' | 'done' | 'failed' }
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

/** Regenerate re-sends the last user turn, so main answers with the text it re-used. */
export type RegenerateChatResponse = SendChatResponse & { text: string }
