import { useCallback, useEffect, useReducer } from 'react'
import {
  INITIAL_POWER_STATE,
  powerReducer,
  type PowerEvent,
  type PowerState
} from '../state/powerState'

const BOOT_MS = 1200

export function usePowerState(): {
  state: PowerState
  dispatch: (event: PowerEvent) => void
} {
  const [state, dispatch] = useReducer(powerReducer, INITIAL_POWER_STATE)

  useEffect(() => {
    if (state.status !== 'starting') return
    const timer = window.setTimeout(() => {
      dispatch({ type: 'STARTED' })
    }, BOOT_MS)
    return () => window.clearTimeout(timer)
  }, [state.status, dispatch])

  const stableDispatch = useCallback((event: PowerEvent) => dispatch(event), [])

  return { state, dispatch: stableDispatch }
}

export type { PowerState, PowerEvent } from '../state/powerState'
