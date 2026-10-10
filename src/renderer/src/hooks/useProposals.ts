import { useCallback, useEffect, useRef, useState } from 'react'
import type { ActionProposal } from '@shared/ipc'

interface DecisionOutcome {
  message: string
  approved: boolean
}

export interface UseProposals {
  /** Oldest waiting proposal, i.e. the only one the user can act on. */
  proposal: ActionProposal | null
  /** How many more are queued behind it. */
  queued: number
  busy: boolean
  outcome: DecisionOutcome | null
  decide: (approved: boolean) => Promise<void>
  dismissOutcome: () => void
}

export function useProposals(): UseProposals {
  const [queue, setQueue] = useState<ActionProposal[]>([])
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<DecisionOutcome | null>(null)
  const timers = useRef(new Map<string, number>())

  useEffect(() => {
    const clearTimers = timers.current
    const unsubscribe = window.ashirs.onProposal((next) => {
      setQueue((prev) => (prev.some((entry) => entry.id === next.id) ? prev : [...prev, next]))
      // Mirrors the main process TTL so the card never offers a decision it will refuse.
      const delay = Math.max(0, next.expiresAt - Date.now())
      const timer = window.setTimeout(() => {
        setQueue((prev) => prev.filter((entry) => entry.id !== next.id))
        clearTimers.delete(next.id)
      }, delay)
      clearTimers.set(next.id, timer)
    })
    return () => {
      unsubscribe()
      for (const timer of clearTimers.values()) window.clearTimeout(timer)
      clearTimers.clear()
    }
  }, [])

  const decide = useCallback(
    async (approved: boolean): Promise<void> => {
      const current = queue[0]
      // Guards against a double click sending a second decision for the same card.
      if (!current || busy) return
      setBusy(true)
      try {
        const message = await window.ashirs.decideProposal(current.id, approved)
        setOutcome({ message, approved })
        setQueue((prev) => prev.filter((entry) => entry.id !== current.id))
      } finally {
        const timer = timers.current.get(current.id)
        if (timer !== undefined) window.clearTimeout(timer)
        timers.current.delete(current.id)
        setBusy(false)
      }
    },
    [queue, busy]
  )

  const dismissOutcome = useCallback((): void => setOutcome(null), [])

  return {
    proposal: queue[0] ?? null,
    queued: Math.max(0, queue.length - 1),
    busy,
    outcome,
    decide,
    dismissOutcome
  }
}
