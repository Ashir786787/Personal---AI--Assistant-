import { describe, expect, it } from 'vitest'
import { isSupportedApp, listSupportedApps } from '../../src/main/system/apps'
import {
  createProposal,
  getProposal,
  resolveProposal,
  type ProposalKind
} from '../../src/main/tools/proposals'

describe('app launch whitelist', () => {
  it('accepts common names in any case and spacing', () => {
    expect(isSupportedApp('Notepad')).toBe(true)
    expect(isSupportedApp('  CALCULATOR ')).toBe(true)
    expect(isSupportedApp('task manager')).toBe(true)
    expect(isSupportedApp('file explorer')).toBe(true)
  })

  it('refuses anything not on the list — especially executables', () => {
    expect(isSupportedApp('vanguard.exe')).toBe(false)
    expect(isSupportedApp('cmd')).toBe(false)
    expect(isSupportedApp('powershell')).toBe(false)
    expect(isSupportedApp('registry editor')).toBe(false)
    expect(isSupportedApp('')).toBe(false)
  })

  it('never offers system shells through the supported list', () => {
    const labels = listSupportedApps().join(', ').toLowerCase()
    expect(labels).not.toContain('cmd')
    expect(labels).not.toContain('powershell')
    expect(labels).not.toContain('registry')
  })
})

describe('typed proposal store', () => {
  const kinds: ProposalKind[] = ['organize', 'volume', 'brightness', 'launch', 'mute']

  it.each(kinds)('round-trips a %s proposal with its payload', (kind) => {
    const created = createProposal({
      kind,
      payload: kind === 'volume' ? { level: 40 } : kind === 'launch' ? { app: 'notepad' } : {}
    })
    const stored = getProposal(created.id)
    expect(stored?.kind).toBe(kind)
    if (kind === 'volume') expect(stored?.payload.level).toBe(40)
    if (kind === 'launch') expect(stored?.payload.app).toBe('notepad')
    resolveProposal(created.id)
    expect(getProposal(created.id)).toBeUndefined()
  })
})
