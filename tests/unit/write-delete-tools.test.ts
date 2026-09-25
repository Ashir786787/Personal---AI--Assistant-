import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDeleteFileTool, createWriteFileTool } from '../../src/main/tools/file-tools'
import { PathScopeError, setAllowedRootsOverride } from '../../src/main/fs/scope'
import type { ActionProposal } from '@shared/ipc'

let sandbox = ''
let fakeRoot = ''

function captureProposals(): { proposals: ActionProposal[]; emit: (p: ActionProposal) => void } {
  const proposals: ActionProposal[] = []
  return { proposals, emit: (p) => proposals.push(p) }
}

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'ashirs-write-delete-'))
  fakeRoot = join(sandbox, 'Downloads')
  mkdirSync(fakeRoot)
  setAllowedRootsOverride([fakeRoot])
})

afterEach(() => {
  setAllowedRootsOverride(null)
  rmSync(sandbox, { recursive: true, force: true })
})

describe('write_file tool', () => {
  it('proposes rewriting an existing file and never claims it wrote', async () => {
    writeFileSync(join(fakeRoot, 'notes.txt'), 'old')
    const capture = captureProposals()
    const tool = createWriteFileTool(capture.emit)
    const result = await tool.execute({ path: 'notes.txt', content: 'new text' })

    expect(capture.proposals).toHaveLength(1)
    expect(capture.proposals[0]!.title).toMatch(/Write/)
    expect(capture.proposals[0]!.totalMoves).toBe(1)
    expect(capture.proposals[0]!.detailLines.join(' ')).toMatch(/notes\.txt/)
    expect(result).toMatch(/confirmation dialog/i)
    expect(result).toMatch(/never claim/i)
  })

  it('refuses an empty content argument', async () => {
    writeFileSync(join(fakeRoot, 'notes.txt'), 'old')
    const tool = createWriteFileTool(() => undefined)
    await expect(tool.execute({ path: 'notes.txt', content: '   ' })).resolves.toMatch(/TOOL_ERROR/)
  })

  it('rejects an out-of-sandbox target', async () => {
    const tool = createWriteFileTool(() => undefined)
    await expect(
      tool.execute({ path: 'C:\\Windows\\temp.txt', content: 'x' })
    ).rejects.toBeInstanceOf(PathScopeError)
  })
})

describe('delete_file tool', () => {
  it('proposes deleting an existing file', async () => {
    writeFileSync(join(fakeRoot, 'old.txt'), 'x')
    const capture = captureProposals()
    const tool = createDeleteFileTool(capture.emit)
    const result = await tool.execute({ path: 'old.txt' })

    expect(capture.proposals).toHaveLength(1)
    expect(capture.proposals[0]!.title).toMatch(/Delete/)
    expect(capture.proposals[0]!.totalMoves).toBe(1)
    expect(capture.proposals[0]!.detailLines.join(' ')).toMatch(/old\.txt/)
    expect(result).toMatch(/confirmation dialog/i)
  })

  it('refuses a missing path argument', async () => {
    const tool = createDeleteFileTool(() => undefined)
    await expect(tool.execute({})).resolves.toMatch(/TOOL_ERROR/)
  })

  it('rejects deleting into protected system areas', async () => {
    const tool = createDeleteFileTool(() => undefined)
    await expect(tool.execute({ path: 'C:\\Windows\\System32\\x.dll' })).rejects.toBeInstanceOf(
      PathScopeError
    )
  })
})
