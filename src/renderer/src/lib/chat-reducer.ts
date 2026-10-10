import type { ProviderId } from '@shared/providers'
import type { ToolStatus } from '@shared/chat'

export type UiRole = 'user' | 'assistant' | 'system' | 'tool' | 'error'

export interface UiMessage {
  id: string
  role: UiRole
  content: string
  provider?: ProviderId
  streaming?: boolean
  elapsedMs?: number
  turnId?: string
  kind?: 'tool' | 'agent'
  toolId?: string
  toolStatus?: ToolStatus
  detail?: string
  statusDetail?: string
}

export interface ChatState {
  messages: UiMessage[]
  busy: boolean
  turnId: string | null
  turnStartedAt: number
  assistantId: string | null
  lastUserId: string | null
}

export const initialChatState: ChatState = {
  messages: [],
  busy: false,
  turnId: null,
  turnStartedAt: 0,
  assistantId: null,
  lastUserId: null
}

const TERMINAL_STATUSES: ReadonlySet<ToolStatus> = new Set<ToolStatus>([
  'done',
  'failed',
  'cancelled'
])

export function isTerminalToolStatus(status: ToolStatus | undefined): boolean {
  return status !== undefined && TERMINAL_STATUSES.has(status)
}

export type ChatAction =
  | { type: 'notice'; id: string; message: string }
  | { type: 'user-sent'; id: string; text: string; turnId: string; now: number }
  | { type: 'regenerate'; turnId: string; now: number }
  | { type: 'send-failed'; userId: string; id: string; message: string; now: number }
  | { type: 'turn-start'; turnId: string; now: number }
  | { type: 'provider-start'; id: string; provider: ProviderId; now: number }
  | { type: 'delta'; text: string }
  | { type: 'tool-start'; id: string; toolId: string; name: string; detail: string }
  | { type: 'tool-status'; toolId: string; status: ToolStatus; detail?: string }
  | { type: 'agent-start'; id: string; agentId: string; name: string }
  | { type: 'agent-end'; agentId: string; status: 'done' | 'failed' }
  | { type: 'settle'; now: number }
  | { type: 'error'; id: string; message: string; now: number }
  | { type: 'reset' }

function settleAssistant(state: ChatState, now: number): ChatState {
  const elapsedMs = state.turnStartedAt > 0 ? Math.max(0, now - state.turnStartedAt) : undefined
  return {
    ...state,
    assistantId: null,
    busy: false,
    messages: state.messages.map((message) =>
      message.streaming
        ? { ...message, streaming: false, ...(elapsedMs ? { elapsedMs } : {}) }
        : message
    )
  }
}

/**
 * The streaming assistant bubble only ever holds the raw TOOL_ACTION line, so it is
 * removed when the matching tool card appears instead of leaving protocol JSON on screen.
 */
function dropStreamingAssistant(state: ChatState): UiMessage[] {
  return state.messages.filter((message) => message.id !== state.assistantId)
}

function toolIndex(state: ChatState, toolId: string): number {
  return state.messages.findIndex((message) => message.toolId === toolId)
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'notice':
      return {
        ...state,
        messages: [...state.messages, { id: action.id, role: 'error', content: action.message }]
      }

    case 'user-sent':
      return {
        ...state,
        busy: true,
        turnId: action.turnId,
        turnStartedAt: action.now,
        assistantId: null,
        lastUserId: action.id,
        messages: [
          ...state.messages,
          { id: action.id, role: 'user', content: action.text, turnId: action.turnId }
        ]
      }

    case 'regenerate': {
      if (state.lastUserId === null) return state
      const cut = state.messages.findIndex((message) => message.id === state.lastUserId)
      if (cut === -1) return state
      return {
        ...state,
        busy: true,
        turnId: action.turnId,
        turnStartedAt: action.now,
        assistantId: null,
        messages: state.messages.slice(0, cut)
      }
    }

    case 'send-failed': {
      const settled = settleAssistant(state, action.now)
      return {
        ...settled,
        messages: [
          ...settled.messages.filter((message) => message.id !== action.userId),
          { id: action.id, role: 'error', content: action.message }
        ]
      }
    }

    case 'turn-start':
      return { ...state, busy: true, turnId: action.turnId, turnStartedAt: action.now }

    case 'provider-start': {
      // A failover starts a second provider bubble, so the partial one is settled first
      // with the real clock instead of an elapsed time of 0.
      const settled = settleAssistant({ ...state, busy: true }, action.now)
      return {
        ...settled,
        busy: true,
        messages: [
          ...settled.messages,
          {
            id: action.id,
            role: 'assistant',
            content: '',
            provider: action.provider,
            streaming: true,
            ...(settled.turnId ? { turnId: settled.turnId } : {})
          }
        ],
        assistantId: action.id
      }
    }

    case 'delta':
      if (state.assistantId === null) return state
      return {
        ...state,
        messages: state.messages.map((message) =>
          message.id === state.assistantId
            ? { ...message, content: message.content + action.text }
            : message
        )
      }

    case 'tool-start': {
      const kept = dropStreamingAssistant(state)
      const turnId = state.turnId ?? undefined
      return {
        ...state,
        assistantId: null,
        messages: [
          ...kept,
          {
            id: action.id,
            role: 'tool',
            kind: 'tool',
            content: action.name,
            toolId: action.toolId,
            toolStatus: 'running',
            detail: action.detail,
            ...(turnId ? { turnId } : {})
          }
        ]
      }
    }

    case 'tool-status': {
      const index = toolIndex(state, action.toolId)
      if (index === -1) return state
      const target = state.messages[index]
      if (!target || isTerminalToolStatus(target.toolStatus)) return state
      const next = state.messages.slice()
      next[index] = {
        ...target,
        toolStatus: action.status,
        ...(action.detail !== undefined ? { statusDetail: action.detail } : {})
      }
      return { ...state, messages: next }
    }

    case 'agent-start': {
      const toolId = `agent-${action.agentId}`
      const index = toolIndex(state, toolId)
      if (index !== -1) return state
      const turnId = state.turnId ?? undefined
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            id: action.id,
            role: 'tool',
            kind: 'agent',
            content: action.name,
            toolId,
            toolStatus: 'running',
            detail: 'working',
            ...(turnId ? { turnId } : {})
          }
        ]
      }
    }

    case 'agent-end': {
      const toolId = `agent-${action.agentId}`
      const index = toolIndex(state, toolId)
      if (index === -1) return state
      const target = state.messages[index]
      if (!target || isTerminalToolStatus(target.toolStatus)) return state
      const next = state.messages.slice()
      next[index] = {
        ...target,
        toolStatus: action.status,
        detail: action.status === 'done' ? 'finished' : 'failed'
      }
      return { ...state, messages: next }
    }

    case 'settle':
      return settleAssistant(state, action.now)

    case 'error': {
      const settled = settleAssistant(state, action.now)
      return {
        ...settled,
        messages: [
          ...settled.messages.map((message) =>
            message.role === 'tool' &&
            message.turnId === state.turnId &&
            !isTerminalToolStatus(message.toolStatus)
              ? { ...message, toolStatus: 'failed' as ToolStatus, statusDetail: action.message }
              : message
          ),
          { id: action.id, role: 'error', content: action.message }
        ]
      }
    }

    case 'reset':
      return initialChatState
  }
}

/** Regenerate is only meaningful on a finished turn that produced an answer. */
export function canRegenerate(state: ChatState): boolean {
  if (state.busy || state.lastUserId === null) return false
  const last = state.messages[state.messages.length - 1]
  return last?.role === 'assistant' && !last.streaming && last.content.length > 0
}
