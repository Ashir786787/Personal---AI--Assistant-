import type { PlannedMove } from './organizer'

export type ProposalKind = 'organize' | 'volume' | 'brightness' | 'launch' | 'mute'

export interface ProposalPayload {
  level?: number
  app?: string
  moves?: PlannedMove[]
}

export interface PendingProposal {
  id: string
  kind: ProposalKind
  sourceDir?: string
  sourceName?: string
  payload: ProposalPayload
  createdAt: number
}

const proposals = new Map<string, PendingProposal>()

export function createProposal(
  input: Omit<PendingProposal, 'id' | 'createdAt'> & { payload?: ProposalPayload }
): PendingProposal {
  const proposal: PendingProposal = {
    ...input,
    payload: input.payload ?? {},
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
