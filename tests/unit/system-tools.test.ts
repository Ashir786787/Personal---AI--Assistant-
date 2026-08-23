import { describe, expect, it } from 'vitest'
import {
  isSupportedApp,
  listSupportedApps,
  resolveApp,
  sanitizeUrl
} from '../../src/main/system/apps'
import {
  createProposal,
  getProposal,
  resolveProposal,
  type ProposalKind
} from '../../src/main/tools/proposals'

describe('app launch whitelist', () => {
  it('accepts every advertised label exactly as the tool description spells it', () => {
    for (const label of listSupportedApps()) {
      expect(isSupportedApp(label), `label "${label}" must be accepted`).toBe(true)
    }
  })

  it('accepts common names in any case and spacing', () => {
    expect(isSupportedApp('Notepad')).toBe(true)
    expect(isSupportedApp('  CALCULATOR ')).toBe(true)
    expect(isSupportedApp('task manager')).toBe(true)
    expect(isSupportedApp('file explorer')).toBe(true)
    expect(isSupportedApp('Google Chrome')).toBe(true)
    expect(isSupportedApp('Microsoft Edge')).toBe(true)
    expect(isSupportedApp('vs code')).toBe(true)
  })

  it('resolves the real browser name into spawn args (regression: dropped arg)', () => {
    const chrome = resolveApp('Google Chrome')
    expect(chrome).not.toBeNull()
    expect(chrome?.args).toContain('chrome')
    expect(chrome?.browser).toBe(true)
    const edge = resolveApp('microsoft edge')
    expect(edge?.args).toContain('msedge')
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

describe('url sanitization for browser launches', () => {
  it('allows ordinary https addresses and encoded queries', () => {
    expect(sanitizeUrl('https://youtube.com')).toBe('https://youtube.com')
    expect(sanitizeUrl('https://www.google.com/search?q=open+youtube')).toBeTruthy()
    expect(sanitizeUrl('http://example.com/a%20b')).toBe('http://example.com/a%20b')
  })

  it('rejects command-injection shaped input', () => {
    expect(sanitizeUrl('https://x.com" & calc.exe')).toBeNull()
    expect(sanitizeUrl('file:///C:/Windows/System32/config')).toBeNull()
    expect(sanitizeUrl('https://x.com/%zz')).toBeNull()
    expect(sanitizeUrl('javascript:alert(1)')).toBeNull()
    expect(sanitizeUrl(42)).toBeNull()
    expect(sanitizeUrl(`https://x.com/${'a'.repeat(2100)}`)).toBeNull()
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
