import { describe, expect, it } from 'vitest'
import {
  canRegenerate,
  chatReducer,
  initialChatState,
  type ChatAction,
  type ChatState,
  type UiMessage
} from '../../src/renderer/src/lib/chat-reducer'

function run(state: ChatState, ...actions: ChatAction[]): ChatState {
  return actions.reduce(chatReducer, state)
}

function sent(): ChatState {
  return chatReducer(initialChatState, {
    type: 'user-sent',
    id: 'u1',
    text: 'tidy Downloads',
    turnId: 't1',
    now: 1000
  })
}

function toolMessage(messages: UiMessage[], toolId: string): UiMessage {
  const found = messages.find((message) => message.toolId === toolId)
  if (!found) throw new Error(`no tool message for ${toolId}`)
  return found
}

describe('chat reducer', () => {
  it('marks the turn busy and keeps the user bubble with its turn id', () => {
    const state = sent()
    expect(state.busy).toBe(true)
    expect(state.turnId).toBe('t1')
    expect(state.messages).toHaveLength(1)
    expect(state.messages[0]).toMatchObject({ role: 'user', turnId: 't1' })
  })

  it('streams deltas into the provider bubble and settles elapsed time', () => {
    const state = run(
      sent(),
      { type: 'provider-start', id: 'a1', provider: 'groq', now: 1100 },
      { type: 'delta', text: 'Hello' },
      { type: 'delta', text: ' there' },
      { type: 'settle', now: 2300 }
    )
    const assistant = state.messages[1]
    expect(assistant).toMatchObject({ content: 'Hello there', streaming: false, elapsedMs: 1300 })
    expect(state.busy).toBe(false)
  })

  it('drops the raw tool line from the stream when the tool card appears', () => {
    const state = run(
      sent(),
      { type: 'provider-start', id: 'a1', provider: 'groq', now: 1100 },
      { type: 'delta', text: 'TOOL_ACTION: organize_files' },
      {
        type: 'tool-start',
        id: 'm1',
        toolId: 'tl-1',
        name: 'organize_files',
        detail: 'path=Downloads'
      }
    )
    expect(state.messages.some((message) => message.content.includes('TOOL_ACTION'))).toBe(false)
    expect(toolMessage(state.messages, 'tl-1')).toMatchObject({
      role: 'tool',
      kind: 'tool',
      toolStatus: 'running',
      turnId: 't1'
    })
  })

  it('never moves a tool card out of a terminal status', () => {
    const state = run(
      sent(),
      { type: 'tool-start', id: 'm1', toolId: 'tl-1', name: 'delete_file', detail: '' },
      { type: 'tool-status', toolId: 'tl-1', status: 'failed', detail: 'refused' },
      { type: 'tool-status', toolId: 'tl-1', status: 'done' }
    )
    expect(toolMessage(state.messages, 'tl-1')).toMatchObject({
      toolStatus: 'failed',
      statusDetail: 'refused'
    })
  })

  it('fails every unfinished card of the turn when the turn errors', () => {
    const state = run(
      sent(),
      { type: 'tool-start', id: 'm1', toolId: 'tl-1', name: 'organize_files', detail: '' },
      { type: 'agent-start', id: 'm2', agentId: 'alice', name: 'Alice Files' },
      { type: 'error', id: 'e1', message: 'provider exploded', now: 4000 }
    )
    expect(toolMessage(state.messages, 'tl-1').toolStatus).toBe('failed')
    expect(toolMessage(state.messages, 'agent-alice').toolStatus).toBe('failed')
    expect(state.messages.at(-1)).toMatchObject({ role: 'error', content: 'provider exploded' })
    expect(state.busy).toBe(false)
  })

  it('keeps earlier turns untouched when a later turn fails', () => {
    const first = run(
      sent(),
      { type: 'tool-start', id: 'm1', toolId: 'tl-1', name: 'list_files', detail: '' },
      { type: 'tool-status', toolId: 'tl-1', status: 'done' },
      { type: 'settle', now: 2000 }
    )
    const second = run(
      first,
      { type: 'user-sent', id: 'u2', text: 'again', turnId: 't2', now: 3000 },
      { type: 'tool-start', id: 'm2', toolId: 'tl-2', name: 'list_files', detail: '' },
      { type: 'error', id: 'e1', message: 'boom', now: 4000 }
    )
    expect(toolMessage(second.messages, 'tl-1').toolStatus).toBe('done')
    expect(toolMessage(second.messages, 'tl-2').toolStatus).toBe('failed')
  })

  it('settles the partial bubble with a real elapsed time when a provider fails over', () => {
    const state = run(
      sent(),
      { type: 'provider-start', id: 'a1', provider: 'groq', now: 1100 },
      { type: 'delta', text: 'partial' },
      { type: 'provider-start', id: 'a2', provider: 'gemini', now: 2600 },
      { type: 'delta', text: 'answer' },
      { type: 'settle', now: 3000 }
    )
    expect(state.messages[1]).toMatchObject({
      content: 'partial',
      streaming: false,
      elapsedMs: 1600
    })
    expect(state.messages[2]).toMatchObject({
      content: 'answer',
      provider: 'gemini',
      elapsedMs: 2000
    })
  })

  it('truncates the failed user turn and its cards when the send never lands', () => {
    const state = run(
      sent(),
      { type: 'provider-start', id: 'a1', provider: 'groq', now: 1100 },
      { type: 'delta', text: 'half' },
      { type: 'send-failed', userId: 'u1', id: 'e1', message: 'never reached', now: 1500 }
    )
    expect(state.messages.some((message) => message.role === 'user')).toBe(false)
    expect(state.busy).toBe(false)
    expect(state.messages.at(-1)).toMatchObject({ role: 'error', content: 'never reached' })
  })

  it('regenerate cuts the last user turn and everything after it', () => {
    const first = run(
      sent(),
      { type: 'provider-start', id: 'a1', provider: 'groq', now: 1100 },
      { type: 'delta', text: 'first answer' },
      { type: 'settle', now: 2000 }
    )
    expect(canRegenerate(first)).toBe(true)
    const second = chatReducer(first, { type: 'regenerate', turnId: 't2', now: 5000 })
    expect(second.messages.every((message) => message.id !== 'u1')).toBe(true)
    expect(second.busy).toBe(true)
    expect(second.turnId).toBe('t2')
    expect(canRegenerate(second)).toBe(false)
  })

  it('reset returns the initial state and stream reset clears the transcript', () => {
    const state = run(sent(), { type: 'reset' })
    expect(state).toEqual(initialChatState)
  })
})
