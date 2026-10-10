import { beforeEach, describe, expect, it } from 'vitest'
import {
  PROPOSAL_TTL_MS,
  claimNewProposals,
  createProposal,
  getProposal,
  isDestructiveProposal,
  pendingProposalCount,
  proposalEpoch,
  proposalToolForKind,
  resolveProposal,
  sweepExpiredProposals
} from '../../src/main/tools/proposals'

beforeEach(() => {
  sweepExpiredProposals(Number.MAX_SAFE_INTEGER)
  expect(pendingProposalCount()).toBe(0)
})

describe('proposal lifecycle', () => {
  it('gives every proposal a unique id and a five minute deadline', () => {
    const first = createProposal({ kind: 'organize', payload: {} })
    const second = createProposal({ kind: 'organize', payload: {} })
    expect(first.id).not.toBe(second.id)
    expect(first.expiresAt - first.createdAt).toBe(PROPOSAL_TTL_MS)
  })

  it('refuses a decision after the deadline and drops the entry', () => {
    const proposal = createProposal({ kind: 'mute', payload: {} })
    expect(getProposal(proposal.id, proposal.expiresAt + 1)).toBeUndefined()
    expect(pendingProposalCount()).toBe(0)
  })

  it('sweeps expired proposals without touching live ones', () => {
    const stale = createProposal({ kind: 'mute', payload: {} })
    const fresh = createProposal({ kind: 'mute', payload: {}, createdAt: Date.now() + 60_000 })
    const removed = sweepExpiredProposals(stale.expiresAt)
    expect(removed).toBe(1)
    expect(getProposal(fresh.id)).toBeDefined()
  })

  it('resolves a proposal so the same decision cannot be replayed', () => {
    const proposal = createProposal({ kind: 'delete', payload: {} })
    resolveProposal(proposal.id)
    expect(getProposal(proposal.id)).toBeUndefined()
  })

  it('claims only proposals raised after the recorded epoch', () => {
    const before = proposalEpoch()
    const mine = createProposal({ kind: 'delete', payload: {} })
    const claimed = claimNewProposals(before, 'alice')
    expect(claimed.map((entry) => entry.id)).toEqual([mine.id])
    expect(mine.agentId).toBe('alice')
  })

  it('never overwrites an agent that a proposal already belongs to', () => {
    const before = proposalEpoch()
    const proposal = createProposal({ kind: 'delete', payload: {}, agentId: 'bob' })
    claimNewProposals(before, 'alice')
    expect(proposal.agentId).toBe('bob')
  })

  it('marks the irreversible kinds destructive and the rest inline', () => {
    for (const kind of ['write', 'delete', 'deleteRoutine'] as const) {
      expect(isDestructiveProposal(kind), kind).toBe(true)
    }
    for (const kind of [
      'organize',
      'schedule',
      'volume',
      'mute',
      'brightness',
      'launch'
    ] as const) {
      expect(isDestructiveProposal(kind), kind).toBe(false)
    }
  })

  it('maps every kind to the tool that must have been allowed to raise it', () => {
    expect(proposalToolForKind('deleteRoutine')).toBe('delete_routine')
    expect(proposalToolForKind('write')).toBe('write_file')
    expect(proposalToolForKind('organize')).toBe('organize_folder')
  })
})
