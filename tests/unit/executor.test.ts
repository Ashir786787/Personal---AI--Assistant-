import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { executeOrganizationPlan } from '../../src/main/fs/executor'
import type { PlannedMove } from '../../src/main/tools/organizer'

let sandbox = ''

beforeAll(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'ashirs-exec-'))
})

afterAll(() => {
  rmSync(sandbox, { recursive: true, force: true })
})

function seed(name: string): void {
  writeFileSync(join(sandbox, name), 'x')
}

describe('executeOrganizationPlan', () => {
  it('moves files into typed subfolders and creates them on demand', () => {
    seed('a.pdf')
    seed('b.png')

    const result = executeOrganizationPlan(sandbox, [
      { fileName: 'a.pdf', fromFolder: 'Downloads', toSubfolder: 'Documents' },
      { fileName: 'b.png', fromFolder: 'Downloads', toSubfolder: 'Images' }
    ])

    expect(result.moved).toBe(2)
    expect(result.failed).toHaveLength(0)
    expect(existsSync(join(sandbox, 'Documents', 'a.pdf'))).toBe(true)
    expect(existsSync(join(sandbox, 'Images', 'b.png'))).toBe(true)
  })

  it('renames instead of overwriting on name collisions', () => {
    mkdirSync(join(sandbox, 'Archives'), { recursive: true })
    seed('dup.zip')
    writeFileSync(join(sandbox, 'Archives', 'dup.zip'), 'existing')

    const result = executeOrganizationPlan(sandbox, [
      { fileName: 'dup.zip', fromFolder: 'Downloads', toSubfolder: 'Archives' }
    ])

    expect(result.moved).toBe(1)
    expect(existsSync(join(sandbox, 'Archives', 'dup (1).zip'))).toBe(true)
    expect(readdirSync(join(sandbox, 'Archives'))).toContain('dup.zip')
  })

  it('records failures for vanished files and keeps moving the rest', () => {
    seed('real.txt')
    const moves: PlannedMove[] = [
      { fileName: 'ghost.txt', fromFolder: 'Downloads', toSubfolder: 'Documents' },
      { fileName: 'real.txt', fromFolder: 'Downloads', toSubfolder: 'Documents' }
    ]

    const result = executeOrganizationPlan(sandbox, moves)

    expect(result.moved).toBe(1)
    expect(result.failed).toEqual([{ fileName: 'ghost.txt', reason: 'already gone' }])
  })
})
