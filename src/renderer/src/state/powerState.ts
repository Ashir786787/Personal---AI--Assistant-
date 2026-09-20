// AI power state machine (docs/UI-SPEC.md §5.1). Pure reducer + explicit transition
// table. The 1.2s STARTING boot delay lives in the hook (usePowerState), not here.

export type PowerStatus =
  'off' | 'starting' | 'idle' | 'listening' | 'thinking' | 'speaking' | 'error' | 'mic-denied'

export type PowerEvent =
  | { type: 'START' }
  | { type: 'STARTED' }
  | { type: 'STOP' }
  | { type: 'LISTEN' }
  | { type: 'LISTENED' }
  | { type: 'ASK' }
  | { type: 'ANSWER' }
  | { type: 'SPEAK' }
  | { type: 'SPOKE' }
  | { type: 'FAIL'; message: string }
  | { type: 'RECOVER' }
  | { type: 'MIC_BLOCKED' }

export interface PowerState {
  status: PowerStatus
  error: string | null
}

export const INITIAL_POWER_STATE: PowerState = { status: 'idle', error: null }

const TABLE: Record<PowerStatus, Partial<Record<PowerEvent['type'], PowerStatus>>> = {
  off: { START: 'starting' },
  starting: { STARTED: 'idle', STOP: 'off' },
  idle: {
    LISTEN: 'listening',
    ASK: 'thinking',
    SPEAK: 'speaking',
    STOP: 'off'
  },
  listening: {
    LISTENED: 'idle',
    ASK: 'thinking',
    MIC_BLOCKED: 'mic-denied',
    FAIL: 'error',
    STOP: 'off'
  },
  thinking: {
    ANSWER: 'idle',
    SPEAK: 'speaking',
    FAIL: 'error',
    STOP: 'off'
  },
  speaking: {
    SPOKE: 'idle',
    FAIL: 'error',
    STOP: 'off'
  },
  error: {
    RECOVER: 'idle',
    START: 'starting',
    LISTEN: 'listening',
    STOP: 'off'
  },
  'mic-denied': {
    RECOVER: 'idle',
    START: 'starting',
    STOP: 'off'
  }
}

export function powerReducer(state: PowerState, event: PowerEvent): PowerState {
  const target = TABLE[state.status][event.type]
  if (!target) return state
  return {
    status: target,
    error: event.type === 'FAIL' ? event.message : null
  }
}

export function isPowered(status: PowerStatus): boolean {
  return status !== 'off'
}

export function canListen(status: PowerStatus): boolean {
  return status === 'idle' || status === 'error' || status === 'mic-denied'
}

export function powerLine(state: PowerState, opts: { wakeOn: boolean }): string {
  switch (state.status) {
    case 'off':
      return 'AI is off'
    case 'starting':
      return 'Starting…'
    case 'idle':
      return opts.wakeOn ? 'Online · say the wake phrase' : 'Online'
    case 'listening':
      return 'Listening…'
    case 'thinking':
      return 'Thinking…'
    case 'speaking':
      return 'Speaking…'
    case 'error':
      return state.error ?? 'Something went wrong'
    case 'mic-denied':
      return 'Microphone is blocked — allow it in Windows settings'
  }
}
