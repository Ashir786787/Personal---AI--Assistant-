import { describe, expect, it } from 'vitest'
import { ToolExecutionError, ToolRegistry } from '../../src/main/tools/registry'
import { scopedToolUsage } from '../../src/main/ipc/tool-scope'
import { TOOL_USAGE } from '../../src/shared/tools'
import { TOWN_AGENTS } from '../../src/shared/agents'
import type { ToolDefinition } from '../../src/shared/tools'

function fakeTool(name: string, mutating = false): ToolDefinition {
  return {
    name,
    description: `does ${name}`,
    mutating,
    async execute() {
      return `done ${name}`
    }
  }
}

function buildRegistry(): ToolRegistry {
  const registry = new ToolRegistry()
  for (const name of [
    'list_folder',
    'folder_summary',
    'sandbox_overview',
    'search_files',
    'organize_folder',
    'set_volume',
    'toggle_mute',
    'set_brightness',
    'launch_app',
    'schedule_routine',
    'list_routines',
    'delete_routine'
  ]) {
    registry.register(fakeTool(name))
  }
  return registry
}

describe('agent tool scoping in the main process (spec 5.2)', () => {
  it('definitionsFor returns only the allowlisted tools', () => {
    const registry = buildRegistry()
    const alice = new Set(TOWN_AGENTS.find((a) => a.id === 'alice')!.tools)
    const names = registry.definitionsFor(alice).map((tool) => tool.name)
    expect(names.sort()).toEqual([...alice].sort())
    expect(registry.definitionsFor(null).length).toBe(12)
  })

  it('execute blocks a tool outside the agent allowlist', async () => {
    const registry = buildRegistry()
    const alice = new Set(TOWN_AGENTS.find((a) => a.id === 'alice')!.tools)
    await expect(registry.execute({ tool: 'launch_app', args: {} }, alice)).rejects.toThrow(
      ToolExecutionError
    )
    expect(await registry.execute({ tool: 'list_folder', args: {} }, alice)).toContain('done')
  })

  it('execute without a scope still runs any registered tool', async () => {
    const registry = buildRegistry()
    const result = await registry.execute({ tool: 'launch_app', args: {} })
    expect(result).toContain('done')
  })

  it('mutating tools still refuse to run directly (approval gate unchanged)', async () => {
    const registry = new ToolRegistry()
    registry.register(fakeTool('organize_folder', true))
    await expect(registry.execute({ tool: 'organize_folder', args: {} })).rejects.toThrow(
      ToolExecutionError
    )
  })

  it('the bob and carol allowlists both resolve to real registered tools', () => {
    const registry = buildRegistry()
    const registered = new Set(registry.definitions().map((tool) => tool.name))
    for (const agent of TOWN_AGENTS) {
      for (const tool of agent.tools) expect(registered.has(tool)).toBe(true)
    }
  })
})

describe('scopedToolUsage produced for agents', () => {
  it('covers every allowed tool with a usage example and instructions text', () => {
    const registry = buildRegistry()
    const bob = new Set(TOWN_AGENTS.find((a) => a.id === 'bob')!.tools)
    const text = scopedToolUsage(registry.definitionsFor(bob))
    expect(text).toContain('set_volume {"level": 40}')
    expect(text).toContain('{"tool": "<name>", "args": { ... }}')
    expect(
      scopedToolUsage(
        registry.definitionsFor(new Set(TOWN_AGENTS.find((a) => a.id === 'dave')!.tools))
      )
    ).toBeDefined()
  })

  it('usage map stays in sync with the tool list', () => {
    for (const agent of TOWN_AGENTS) {
      for (const tool of agent.tools) expect(TOOL_USAGE[tool]).toBeDefined()
    }
  })
})
