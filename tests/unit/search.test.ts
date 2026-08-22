import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'path'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { searchWithin } from '../../src/main/fs/search'
import { setAllowedRootsOverride } from '../../src/main/fs/scope'

let base = ''
let sandbox = ''
let secretOutside = ''

beforeAll(() => {
  secretOutside = mkdtempSync(join(tmpdir(), 'ashirs-secret-'))
})

afterAll(() => {
  setAllowedRootsOverride(null)
  rmSync(secretOutside, { recursive: true, force: true })
})

afterEach(() => {
  setAllowedRootsOverride(null)
  if (base) rmSync(base, { recursive: true, force: true })
})

function freshSandbox(): void {
  base = mkdtempSync(join(tmpdir(), 'ashirs-search-'))
  sandbox = join(base, 'Downloads')
  mkdirSync(sandbox, { recursive: true })
  setAllowedRootsOverride([sandbox])
}

describe('searchWithin scoped file search', () => {
  it('finds files by partial case-insensitive name across subfolders', () => {
    freshSandbox()
    mkdirSync(join(sandbox, 'games'), { recursive: true })
    writeFileSync(join(sandbox, 'games', 'VanguardSetup.exe'), 'x')
    writeFileSync(join(sandbox, 'notes.txt'), 'x')

    const hits = searchWithin('Downloads', 'vanguard')
    expect(hits).toHaveLength(1)
    expect(hits[0]!.fileName).toBe('VanguardSetup.exe')
    expect(hits[0]!.relativePath).toBe(join('games', 'VanguardSetup.exe'))
  })

  it('returns nothing for empty query and reports misses', () => {
    freshSandbox()
    writeFileSync(join(sandbox, 'a.txt'), 'x')
    expect(searchWithin('Downloads', '')).toEqual([])
    expect(searchWithin('Downloads', 'zzz-nothing')).toEqual([])
  })

  it('never follows links that point outside the sandbox', () => {
    freshSandbox()
    const bait = join(secretOutside, 'vanguard_secret.txt')
    writeFileSync(bait, 'top secret')

    const linkName = process.platform === 'win32' ? 'vanguard_junction' : 'vanguard_symlink'
    symlinkSync(
      secretOutside,
      join(sandbox, linkName),
      process.platform === 'win32' ? 'junction' : 'dir'
    )

    const hits = searchWithin('Downloads', 'vanguard')

    expect(hits.map((h) => h.fileName)).toContain(linkName)
    expect(hits.map((h) => h.fileName)).not.toContain('vanguard_secret.txt')
  })

  it('caps results at the configured limit', () => {
    freshSandbox()
    for (let i = 0; i < 40; i++) {
      writeFileSync(join(sandbox, `matchme_${i}.txt`), 'x')
    }
    const hits = searchWithin('Downloads', 'matchme', {
      maxDepth: 6,
      maxResults: 10,
      maxScanned: 20000
    })
    expect(hits).toHaveLength(10)
  })

  it('respects depth limits so shallow searches stay fast', () => {
    freshSandbox()
    mkdirSync(join(sandbox, 'a', 'b', 'c', 'd'), { recursive: true })
    writeFileSync(join(sandbox, 'a', 'b', 'c', 'd', 'deep_target.txt'), 'x')

    const shallow = searchWithin('Downloads', 'deep_target', {
      maxDepth: 1,
      maxResults: 25,
      maxScanned: 20000
    })
    expect(shallow).toHaveLength(0)

    const deep = searchWithin('Downloads', 'deep_target')
    expect(deep).toHaveLength(1)
  })
})
