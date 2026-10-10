import { randomUUID } from 'node:crypto'
import type { AgentId } from '@shared/agents'
import type { PlannedMove } from './organizer'

export type ProposalKind =
  | 'organize'
  | 'volume'
  | 'brightness'
  | 'launch'
  | 'mute'
  | 'schedule'
  | 'write'
  | 'delete'
  | 'deleteRoutine'

export interface ProposalPayload {
  level?: number
  app?: string
  url?: string
  moves?: PlannedMove[]
  path?: string
  content?: string
  routineId?: string
  routineName?: string
  folderPath?: string
  folderName?: string
  timeHHMM?: string
  /** What the user was shown, so a path that changed type cannot be approved by mistake. */
  isDirectory?: boolean
}

/** Approvals stay actionable for five minutes, then the user must be asked again. */
export const PROPOSAL_TTL_MS = 5 * 60 * 1000

export interface PendingProposal {
  id: string
  kind: ProposalKind
  sourceDir?: string
  sourceName?: string
  payload: ProposalPayload
  createdAt: number
  expiresAt: number
  /** Monotonic creation counter, used to spot proposals raised by one tool call. */
  epoch: number
  /** Which agent asked for it; undefined means the main supervisor. */
  agentId?: AgentId
  /** The chat tool card this approval belongs to, so it can be closed out later. */
  toolId?: string
}

/** Tool name behind each proposal kind, used to re-check an agent's scope on approval. */
const KIND_TOOL: Record<ProposalKind, string> = {
  organize: 'organize_folder',
  volume: 'set_volume',
  brightness: 'set_brightness',
  launch: 'launch_app',
  mute: 'toggle_mute',
  schedule: 'schedule_routine',
  write: 'write_file',
  delete: 'delete_file',
  deleteRoutine: 'delete_routine'
}

/**
 * Deleting, overwriting and removing a routine cannot be undone, so those keep the
 * blocking modal; organizing, scheduling and system tweaks stay inline in the chat.
 */
const DESTRUCTIVE_KINDS: ReadonlySet<ProposalKind> = new Set<ProposalKind>([
  'write',
  'delete',
  'deleteRoutine'
])

export function proposalToolForKind(kind: ProposalKind): string | null {
  return KIND_TOOL[kind] ?? null
}

export function isDestructiveProposal(kind: ProposalKind): boolean {
  return DESTRUCTIVE_KINDS.has(kind)
}

/** Read-only lookup for the renderer payload; never sweeps, never extends the TTL. */
export function pendingProposalFor(id: string): PendingProposal | undefined {
  return proposals.get(id)
}

const proposals = new Map<string, PendingProposal>()
let createdCount = 0

export function createProposal(
  input: Omit<PendingProposal, 'id' | 'createdAt' | 'expiresAt' | 'epoch'> & {
    payload?: ProposalPayload
    createdAt?: number
  }
): PendingProposal {
  const createdAt = input.createdAt ?? Date.now()
  createdCount += 1
  const proposal: PendingProposal = {
    ...input,
    payload: input.payload ?? {},
    id: `prop-${randomUUID()}`,
    createdAt,
    expiresAt: createdAt + PROPOSAL_TTL_MS,
    epoch: createdCount
  }
  proposals.set(proposal.id, proposal)
  return proposal
}

export function proposalEpoch(): number {
  return createdCount
}

/**
 * Returns every proposal created after `epoch` and binds each to the agent whose turn
 * raised it, so `action:decide` can re-check that agent's tool scope.
 */
export function claimNewProposals(epoch: number, agentId: AgentId | undefined): PendingProposal[] {
  const claimed: PendingProposal[] = []
  for (const proposal of proposals.values()) {
    if (proposal.epoch <= epoch) continue
    if (proposal.agentId === undefined) proposal.agentId = agentId
    claimed.push(proposal)
  }
  return claimed
}

export function sweepExpiredProposals(now = Date.now()): number {
  let removed = 0
  for (const [id, proposal] of proposals) {
    if (proposal.expiresAt <= now) {
      proposals.delete(id)
      removed += 1
    }
  }
  return removed
}

export function getProposal(id: string, now = Date.now()): PendingProposal | undefined {
  const proposal = proposals.get(id)
  if (!proposal) return undefined
  if (proposal.expiresAt <= now) {
    proposals.delete(id)
    return undefined
  }
  return proposal
}

export function resolveProposal(id: string): void {
  proposals.delete(id)
}

export function pendingProposalCount(): number {
  return proposals.size
}
