import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  folderSummaryTool,
  listFolderTool,
  sandboxOverviewTool
} from '../../src/main/tools/file-tools'
import { PathScopeError, setAllowedRootsOverride } from '../../src/main/fs/scope'

let sandbox = ''
let fakeRoot = ''

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'ashirs-filetools-'))
  fakeRoot = join(sandbox, 'Downloads')
  mkdirSync(fakeRoot)
  setAllowedRootsOverride([fakeRoot])
})

afterEach(() => {
  setAllowedRootsOverride(null)
  rmSync(sandbox, { recursive: true, force: true })
})

describe('read-only file tools', () => {
  it('list_folder reports contents with sizes', async () => {
    writeFileSync(join(fakeRoot, 'report.pdf'), 'x'.repeat(300))
    const result = await listFolderTool.execute({ path: 'Downloads' })
    expect(result).toContain('report.pdf')
    expect(result).toMatch(/300 B/)
  })

  it('list_folder never escapes the sandbox', async () => {
    await expect(listFolderTool.execute({ path: 'C:\\Windows' })).rejects.toBeInstanceOf(
      PathScopeError
    )
  })

  it('folder_summary groups by extension with byte totals', async () => {
    writeFileSync(join(fakeRoot, 'a.pdf'), 'x'.repeat(100))
    writeFileSync(join(fakeRoot, 'b.pdf'), 'x'.repeat(50))
    writeFileSync(join(fakeRoot, 'c.jpg'), 'x'.repeat(10))
    const result = await folderSummaryTool.execute({ path: 'Downloads' })
    expect(result).toContain('pdf: 2 files')
    expect(result).toContain('150 B')
  })

  it('sandbox_overview lists every allowed root', async () => {
    const result = await sandboxOverviewTool.execute({})
    expect(result).toContain('Downloads:')
  })

  it('handles empty folders gracefully', async () => {
    const result = await listFolderTool.execute({ path: 'Downloads' })
    expect(result).toMatch(/empty/i)
  })
})
