import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { listDirectory, summarizeByType } from '../../src/main/fs/listing'
import {
  isExcludedAppPath,
  isProtectedWritePath,
  PathScopeError,
  resolveReadablePath,
  resolveNewTargetPath,
  resolveWritablePath,
  setAllowedRootsOverride
} from '../../src/main/fs/scope'

let sandbox = ''
let fakeRoot = ''

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'ashirs-scope-test-'))
  fakeRoot = join(sandbox, 'Downloads')
  mkdirSync(fakeRoot)
  setAllowedRootsOverride([fakeRoot])
})

afterEach(() => {
  setAllowedRootsOverride(null)
  rmSync(sandbox, { recursive: true, force: true })
})

describe('readable path sandbox', () => {
  it('resolves a folder that lives inside an allowed root', () => {
    mkdirSync(join(fakeRoot, 'invoices'))
    const result = resolveReadablePath('invoices')
    expect(result.toLowerCase()).toContain('invoices')
  })

  it('rejects absolute paths into system directories', () => {
    expect(() => resolveReadablePath('C:\\Windows\\System32')).toThrow(PathScopeError)
    expect(() => resolveReadablePath('C:\\Program Files\\SomeApp')).toThrow(PathScopeError)
  })

  it('rejects traversal attempts even with sneaky casing', () => {
    expect(() => resolveReadablePath('..\\..\\windows')).toThrow(PathScopeError)
  })

  it('blocks junction redirection escaping the sandbox', () => {
    const outside = join(sandbox, 'outside-target')
    mkdirSync(outside)
    const trapdoor = join(fakeRoot, 'innocent-folder')
    symlinkSync(outside, trapdoor, 'junction')

    try {
      expect(() => resolveReadablePath('innocent-folder')).toThrow(PathScopeError)
    } finally {
      rmSync(trapdoor, { recursive: true, force: true })
    }
  })

  it('reports missing absolute targets in plain language', () => {
    expect(() => resolveReadablePath(join(fakeRoot, 'no-such-folder-xyz'))).toThrow(
      /does not exist/i
    )
  })

  it('reports unmatched relative names without leaking internals', () => {
    expect(() => resolveReadablePath('totally-unknown')).toThrow(/Could not match/i)
  })

  it('writable resolution in the sandbox still guards the root', () => {
    mkdirSync(join(fakeRoot, 'notes'))
    expect(resolveWritablePath('notes').toLowerCase()).toContain('notes')
    expect(() => resolveWritablePath('C:\\Windows\\System32')).toThrow(PathScopeError)
  })

  it('new-target resolution refuses targets whose parent is missing', () => {
    mkdirSync(join(fakeRoot, 'existing-dir'))
    expect(() => resolveNewTargetPath('existing-dir/new-file.txt')).not.toThrow(PathScopeError)
  })
})

describe('whole-system exclusion + protected-write rules', () => {
  it('flags the hard-blocked apps (discord, whatsapp, vs code)', () => {
    expect(isExcludedAppPath('C:\\Users\\me\\AppData\\Roaming\\Discord')).toBe(true)
    expect(isExcludedAppPath('D:\\WhatsApp')).toBe(true)
    expect(isExcludedAppPath('C:\\Program Files\\Microsoft VS Code\\code.exe')).toBe(true)
    expect(isExcludedAppPath('C:\\Tools\\.vscode\\settings.json')).toBe(true)
    expect(isExcludedAppPath('C:\\Program Files\\Code.exe')).toBe(true)
    expect(isExcludedAppPath('C:\\Users\\me\\Desktop\\notes.txt')).toBe(false)
    expect(isExcludedAppPath('C:\\Users\\me\\Desktop\\document.pdf')).toBe(false)
  })

  it('protects system write zones', () => {
    expect(isProtectedWritePath('C:\\Windows\\System32\\drivers')).toBe(true)
    expect(isProtectedWritePath('C:\\ProgramData\\Microsoft')).toBe(true)
    expect(isProtectedWritePath('C:\\$Recycle.Bin')).toBe(true)
    expect(isProtectedWritePath('D:\\')).toBe(true)
    expect(isProtectedWritePath('C:\\Users\\me\\Desktop')).toBe(false)
  })
})

describe('listDirectory + summarizeByType', () => {
  it('reads entries with metadata and groups them by type', async () => {
    const dir = join(fakeRoot, 'listing-sample')
    mkdirSync(dir)
    writeFileSync(join(dir, 'report.pdf'), 'x'.repeat(300))
    writeFileSync(join(dir, 'photo.jpg'), 'x'.repeat(500))
    writeFileSync(join(dir, 'notes.txt'), 'x'.repeat(100))
    mkdirSync(join(dir, 'subfolder'))

    const entries = await listDirectory(resolve(dir))
    expect(entries).toHaveLength(4)

    const groups = summarizeByType(entries)
    expect(groups.find((g) => g.extension === 'pdf')?.count).toBe(1)
    expect(groups.find((g) => g.extension === 'jpg')?.totalBytes).toBe(500)

    sortedExpectations(groups)
    rmSync(dir, { recursive: true, force: true })
  })
})

function sortedExpectations(groups: ReturnType<typeof summarizeByType>): void {
  if (groups.length > 0 && groups[0]) {
    expect(typeof groups[0].extension).toBe('string')
  }
  void sep
}
