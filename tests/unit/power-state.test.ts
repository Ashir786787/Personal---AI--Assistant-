import { describe, expect, it } from 'vitest'
import {
  canListen,
  INITIAL_POWER_STATE,
  isPowered,
  powerLine,
  powerReducer,
  type PowerEvent,
  type PowerState
} from '../../src/renderer/src/state/powerState'

function run(start: PowerState, events: PowerEvent[]): PowerState {
  return events.reduce(powerReducer, start)
}

describe('powerReducer', () => {
  it('boots from off via START -> STARTED', () => {
    const state = run(INITIAL_POWER_STATE, [{ type: 'START' }, { type: 'STARTED' }])
    expect(state.status).toBe('idle')
    expect(state.error).toBeNull()
  })

  it('STARTING aborts back to off on STOP', () => {
    const state = run(INITIAL_POWER_STATE, [{ type: 'START' }, { type: 'STOP' }])
    expect(state.status).toBe('off')
  })

  it('idle enters listening and returns idle on LISTENED', () => {
    const state = run(INITIAL_POWER_STATE, [{ type: 'LISTEN' }, { type: 'LISTENED' }])
    expect(state.status).toBe('idle')
  })

  it('listening moves to thinking once speech turns into a question', () => {
    const state = run(INITIAL_POWER_STATE, [{ type: 'LISTEN' }, { type: 'ASK' }])
    expect(state.status).toBe('thinking')
  })

  it('thinking returns idle on ANSWER', () => {
    const state = run(INITIAL_POWER_STATE, [{ type: 'ASK' }, { type: 'ANSWER' }])
    expect(state.status).toBe('idle')
  })

  it('thinking moves to speaking when TTS starts and back to idle when it ends', () => {
    const state = run(INITIAL_POWER_STATE, [{ type: 'ASK' }, { type: 'SPEAK' }, { type: 'SPOKE' }])
    expect(state.status).toBe('idle')
  })

  it('keeps the last failure message in the error state', () => {
    const state = run(INITIAL_POWER_STATE, [
      { type: 'ASK' },
      { type: 'FAIL', message: 'Groq unreachable, trying Gemini' }
    ])
    expect(state.status).toBe('error')
    expect(state.error).toBe('Groq unreachable, trying Gemini')
  })

  it('RECOVER leaves error and clears the message', () => {
    const state = run(INITIAL_POWER_STATE, [
      { type: 'ASK' },
      { type: 'FAIL', message: 'boom' },
      { type: 'RECOVER' }
    ])
    expect(state.status).toBe('idle')
    expect(state.error).toBeNull()
  })

  it('mic-denied is entered from listening and recovers to idle', () => {
    const state = run(INITIAL_POWER_STATE, [{ type: 'LISTEN' }, { type: 'MIC_BLOCKED' }])
    expect(state.status).toBe('mic-denied')
    const recovered = powerReducer(state, { type: 'RECOVER' })
    expect(recovered.status).toBe('idle')
  })

  it('STOP returns to off from every live state', () => {
    for (const status of ['idle', 'listening', 'thinking', 'speaking', 'error'] as const) {
      const from: PowerState = { status, error: status === 'error' ? 'x' : null }
      expect(powerReducer(from, { type: 'STOP' }).status).toBe('off')
    }
    expect(powerReducer({ status: 'starting', error: null }, { type: 'STOP' }).status).toBe('off')
  })

  it('ignores invalid transitions and leaves the state unchanged', () => {
    const off = powerReducer({ status: 'off', error: null }, { type: 'STARTED' })
    expect(off.status).toBe('off')
    const starting = powerReducer({ status: 'starting', error: null }, { type: 'ASK' })
    expect(starting.status).toBe('starting')
  })

  it('exposes power gating helpers', () => {
    expect(isPowered('idle')).toBe(true)
    expect(isPowered('off')).toBe(false)
    expect(canListen('idle')).toBe(true)
    expect(canListen('thinking')).toBe(false)
    expect(canListen('error')).toBe(true)
    expect(canListen('mic-denied')).toBe(true)
  })

  it('renders honest state text per status', () => {
    expect(powerLine({ status: 'off', error: null }, { wakeOn: true })).toBe('AI is off')
    expect(powerLine({ status: 'starting', error: null }, { wakeOn: false })).toBe('Starting…')
    expect(powerLine({ status: 'idle', error: null }, { wakeOn: true })).toBe(
      'Online · say the wake phrase'
    )
    expect(powerLine({ status: 'idle', error: null }, { wakeOn: false })).toBe('Online')
    expect(powerLine({ status: 'error', error: 'Kaput' }, { wakeOn: false })).toBe('Kaput')
    expect(powerLine({ status: 'mic-denied', error: null }, { wakeOn: false })).toMatch(
      /Microphone is blocked/
    )
  })
})
