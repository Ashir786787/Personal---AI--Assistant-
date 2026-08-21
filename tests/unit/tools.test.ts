import { describe, expect, it } from 'vitest'
import { extractToolAction } from '../../src/main/tools/parse'
import { ToolExecutionError, ToolRegistry } from '../../src/main/tools/registry'
import type { ToolDefinition } from '@shared/tools'

describe('extractToolAction', () => {
  it('parses a fenced json action', () => {
    const text = '```json\n{"tool": "list_folder", "args": {"path": "Downloads"}}\n```'
    expect(extractToolAction(text)).toEqual({ tool: 'list_folder', args: { path: 'Downloads' } })
  })

  it('parses a bare json object without fencing', () => {
    const text = '{"tool": "sandbox_overview", "args": {}}'
    expect(extractToolAction(text)?.tool).toBe('sandbox_overview')
  })

  it('returns null for ordinary prose answers', () => {
    expect(extractToolAction('Here is what I found in your Downloads folder.')).toBeNull()
  })

  it('returns null for malformed json', () => {
    expect(extractToolAction('```json\n{"tool": broken\n```')).toBeNull()
  })

  it('defaults missing args to an empty object', () => {
    const action = extractToolAction('{"tool": "folder_summary"}')
    expect(action?.args).toEqual({})
  })
})

describe('ToolRegistry', () => {
  const echo: ToolDefinition = {
    name: 'echo_tool',
    description: 'test',
    mutating: false,
    async execute(args) {
      return String(args['value'] ?? '')
    }
  }
  const destructive: ToolDefinition = {
    name: 'delete_tool',
    description: 'test',
    mutating: true,
    async execute() {
      throw new Error('should never run')
    }
  }

  it('executes a registered read-only tool', async () => {
    const registry = new ToolRegistry()
    registry.register(echo)
    await expect(registry.execute({ tool: 'echo_tool', args: { value: 'hi' } })).resolves.toBe('hi')
  })

  it('refuses unknown tools instead of guessing', async () => {
    const registry = new ToolRegistry()
    await expect(registry.execute({ tool: 'format_c_drive', args: {} })).rejects.toThrow(
      /Unknown tool/
    )
  })

  it('quarantines mutating tools behind approval — they cannot execute yet', async () => {
    const registry = new ToolRegistry()
    registry.register(destructive)
    await expect(registry.execute({ tool: 'delete_tool', args: {} })).rejects.toThrow(
      /requires user approval/
    )
  })

  it('ships with the read-only file tools including the organize proposer', () => {
    const registry = ToolRegistry.withDefaults(() => {})
    expect(registry.has('list_folder')).toBe(true)
    expect(registry.has('folder_summary')).toBe(true)
    expect(registry.has('sandbox_overview')).toBe(true)
    expect(registry.has('organize_folder')).toBe(true)
  })

  it('exposes mutating flag for the confirmation gate to use later', () => {
    const registry = new ToolRegistry()
    registry.register(destructive)
    expect(registry.isMutating('delete_tool')).toBe(true)
    expect(ToolExecutionError).toBeDefined()
  })
})
