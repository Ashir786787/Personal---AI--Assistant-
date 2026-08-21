import type { PlannedMove } from './organizer'

export interface PendingProposal {
  id: string
  sourceDir: string
  sourceName: string
  moves: PlannedMove[]
  createdAt: number
}

const proposals = new Map<string, PendingProposal>()

export function createProposal(input: Omit<PendingProposal, 'id' | 'createdAt'>): PendingProposal {
  const proposal: PendingProposal = {
    ...input,
    id: `prop-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    createdAt: Date.now()
  }
  proposals.set(proposal.id, proposal)
  return proposal
}

export function getProposal(id: string): PendingProposal | undefined {
  return proposals.get(id)
}

export function resolveProposal(id: string): void {
  proposals.delete(id)
}
