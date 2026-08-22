import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  addRoutine,
  deleteRoutine,
  listRoutines,
  markRoutineRun,
  setRoutinesFileForTest
} from '../../src/main/routines/store'
import { dayKeyOf, isRoutineDue } from '../../src/main/routines/scheduler'

let dir = ''

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('routine store persistence', () => {
  it('survives a full reload from disk', () => {
    dir = mkdtempSync(join(tmpdir(), 'ashirs-routines-'))
    setRoutinesFileForTest(join(dir, 'routines.json'))

    const created = addRoutine('Nightly tidy of Downloads', 'Downloads', '21:00')
    markRoutineRun(created.id, '2026-08-23', 'Moved 12 files')

    setRoutinesFileForTest(join(dir, 'routines.json'))
    const reloaded = listRoutines()
    expect(reloaded).toHaveLength(1)
    expect(reloaded[0]!.timeHHMM).toBe('21:00')
    expect(reloaded[0]!.lastResult).toBe('Moved 12 files')

    expect(deleteRoutine(created.id)).toBe(true)
    expect(listRoutines()).toHaveLength(0)
  })

  it('rejects reading a corrupt file by starting empty', () => {
    const corruptDir = mkdtempSync(join(tmpdir(), 'ashirs-routines-bad-'))
    setRoutinesFileForTest(join(corruptDir, 'routines.json'))
    writeFileSync(join(corruptDir, 'routines.json'), '{not valid json')
    expect(listRoutines()).toHaveLength(0)
    rmSync(corruptDir, { recursive: true, force: true })
  })
})

describe('routine due logic', () => {
  it('fires once per day when the time has passed', () => {
    expect(isRoutineDue('21:05', '21:00', null, '2026-08-23')).toBe(true)
  })

  it('does not refire on the same day after running', () => {
    expect(isRoutineDue('22:00', '21:00', '2026-08-23', '2026-08-23')).toBe(false)
  })

  it('waits for tonight after a morning boot instead of catching up mid-day', () => {
    expect(isRoutineDue('09:15', '21:00', '2026-08-22', '2026-08-23')).toBe(false)
  })

  it('fires the next evening even if yesterday was missed entirely', () => {
    expect(isRoutineDue('21:05', '21:00', '2026-08-22', '2026-08-23')).toBe(true)
  })

  it('ignores invalid time formats', () => {
    expect(isRoutineDue('10:00', '25:99', null, '2026-08-23')).toBe(false)
    expect(isRoutineDue('10:00', 'nine', null, '2026-08-23')).toBe(false)
  })

  it('produces sortable day keys', () => {
    const key = dayKeyOf(new Date(2026, 7, 5))
    expect(key).toBe('2026-08-05')
  })
})
