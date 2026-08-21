import { useCallback, useEffect, useState } from 'react'
import type { ActionProposal } from '@shared/ipc'

interface DecisionOutcome {
  message: string
  approved: boolean
}

export function useProposals(): {
  proposal: ActionProposal | null
  busy: boolean
  outcome: DecisionOutcome | null
  decide: (approved: boolean) => Promise<void>
  dismissOutcome: () => void
} {
  const [proposal, setProposal] = useState<ActionProposal | null>(null)
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<DecisionOutcome | null>(null)

  useEffect(() => {
    const unsubscribe = window.ashirs.onProposal((next) => setProposal(next))
    return unsubscribe
  }, [])

  const decide = useCallback(
    async (approved: boolean): Promise<void> => {
      if (!proposal) return
      setBusy(true)
      try {
        const message = await window.ashirs.decideProposal(proposal.id, approved)
        setOutcome({ message, approved })
        setProposal(null)
      } finally {
        setBusy(false)
      }
    },
    [proposal]
  )

  const dismissOutcome = useCallback((): void => setOutcome(null), [])

  return { proposal, busy, outcome, decide, dismissOutcome }
}
