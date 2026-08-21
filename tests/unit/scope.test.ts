import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { listDirectory, summarizeByType } from '../../src/main/fs/listing'
import { PathScopeError, resolveWithin, setAllowedRootsOverride } from '../../src/main/fs/scope'

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

describe('resolveWithin path sandbox', () => {
  it('resolves a folder that lives inside an allowed root', () => {
    mkdirSync(join(fakeRoot, 'invoices'))
    const result = resolveWithin('invoices')
    expect(result.absolutePath.toLowerCase()).toContain('invoices')
    expect(result.root.toLowerCase()).toBe(fakeRoot.toLowerCase())
  })

  it('rejects absolute paths into system directories', () => {
    expect(() => resolveWithin('C:\\Windows\\System32')).toThrow(PathScopeError)
    expect(() => resolveWithin('C:\\Program Files\\SomeApp')).toThrow(PathScopeError)
  })

  it('rejects traversal attempts even with sneaky casing', () => {
    expect(() => resolveWithin('..\\..\\windows')).toThrow(PathScopeError)
  })

  it('blocks junction redirection escaping the sandbox', () => {
    const outside = join(sandbox, 'outside-target')
    mkdirSync(outside)
    const trapdoor = join(fakeRoot, 'innocent-folder')
    symlinkSync(outside, trapdoor, 'junction')

    try {
      expect(() => resolveWithin('innocent-folder')).toThrow(PathScopeError)
    } finally {
      rmSync(trapdoor, { recursive: true, force: true })
    }
  })

  it('reports missing absolute targets in plain language', () => {
    expect(() => resolveWithin(join(fakeRoot, 'no-such-folder-xyz'))).toThrow(/does not exist/i)
  })

  it('reports unmatched relative names without leaking internals', () => {
    expect(() => resolveWithin('totally-unknown')).toThrow(/Could not match/i)
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
