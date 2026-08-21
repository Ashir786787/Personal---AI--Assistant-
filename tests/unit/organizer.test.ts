import { describe, expect, it } from 'vitest'
import type { FileEntry } from '../../src/main/fs/listing'
import { planOrganization } from '../../src/main/tools/organizer'

function file(name: string, extension: string): FileEntry {
  return {
    name,
    extension,
    sizeBytes: 100,
    modifiedAt: 0,
    isDirectory: false
  }
}

describe('planOrganization dry-run planner', () => {
  it('routes known extensions into typed subfolders', () => {
    const plan = planOrganization('Downloads', [
      file('report.pdf', 'pdf'),
      file('photo.png', 'png'),
      file('setup.exe', 'exe')
    ])

    expect(plan.moves).toEqual([
      { fileName: 'report.pdf', fromFolder: 'Downloads', toSubfolder: 'Documents' },
      { fileName: 'photo.png', fromFolder: 'Downloads', toSubfolder: 'Images' },
      { fileName: 'setup.exe', fromFolder: 'Downloads', toSubfolder: 'Installers' }
    ])
  })

  it('never proposes moving files into their current folder', () => {
    const plan = planOrganization('Documents', [file('notes.txt', 'txt')])
    expect(plan.moves).toHaveLength(0)
  })

  it('skips folders and reports unknown extensions untouched', () => {
    const plan = planOrganization('Downloads', [
      {
        name: 'sub',
        extension: '',
        sizeBytes: 0,
        modifiedAt: 0,
        isDirectory: true
      },
      file('data.xyz', 'xyz'),
      file('blob', '')
    ])

    expect(plan.moves).toHaveLength(0)
    expect(plan.skippedFolders).toBe(1)
    expect(plan.untouchedExtensions).toEqual(['no-extension', 'xyz'])
  })

  it('is a pure function — same input, same plan, zero side effects possible', () => {
    const entries = [file('a.zip', 'zip'), file('b.mp3', 'mp3')]
    const first = planOrganization('Downloads', entries)
    const second = planOrganization('Downloads', entries)
    expect(first).toEqual(second)
  })
})
