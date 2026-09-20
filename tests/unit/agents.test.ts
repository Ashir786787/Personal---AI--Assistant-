import { describe, expect, it } from 'vitest'
import { AGENT_IDS, TOWN_AGENTS, agentConfig, isAgentId } from '../../src/shared/agents'
import { TOOL_USAGE } from '../../src/shared/tools'

describe('TOWN_AGENTS config (spec 5.2)', () => {
  it('covers every validated agent id exactly once', () => {
    const ids = TOWN_AGENTS.map((agent) => agent.id)
    expect(ids).toHaveLength(AGENT_IDS.length)
    expect(new Set(ids).size).toBe(AGENT_IDS.length)
    for (const id of AGENT_IDS) expect(ids).toContain(id)
  })

  it('emits unique names and titled labels', () => {
    const names = TOWN_AGENTS.map((agent) => agent.name)
    expect(new Set(names).size).toBe(names.length)
    expect(TOWN_AGENTS.find((a) => a.name === 'DOUG')).toBeUndefined()
  })

  it('assigns tool lists by domain: alice files, bob system, carol routines, dave none', () => {
    const alice = agentConfig('alice')
    const bob = agentConfig('bob')
    const carol = agentConfig('carol')
    const dave = agentConfig('dave')
    expect(alice.tools).toEqual([
      'list_folder',
      'folder_summary',
      'sandbox_overview',
      'search_files',
      'organize_folder'
    ])
    expect(bob.tools).toEqual(['set_volume', 'toggle_mute', 'set_brightness', 'launch_app'])
    expect(carol.tools).toEqual(['schedule_routine', 'list_routines', 'delete_routine'])
    expect(dave.tools).toEqual([])
  })

  it('dave is the only disconnected agent', () => {
    for (const agent of TOWN_AGENTS) {
      if (agent.id === 'dave') {
        expect(agent.connected).toBe(false)
      } else {
        expect(agent.connected).toBe(true)
      }
    }
  })

  it('every allowed tool has a documented usage example', () => {
    for (const agent of TOWN_AGENTS) {
      for (const tool of agent.tools) {
        expect(TOOL_USAGE[tool], `${agent.id} -> ${tool}`).toBeDefined()
      }
    }
  })

  it('every agent has a system prompt and a canned motto', () => {
    for (const agent of TOWN_AGENTS) {
      expect(agent.systemPrompt.trim().length).toBeGreaterThan(0)
      expect(agent.motto.trim().length).toBeGreaterThan(0)
    }
  })

  it('isAgentId validates ids', () => {
    expect(isAgentId('alice')).toBe(true)
    expect(isAgentId('dave')).toBe(true)
    expect(isAgentId('eve')).toBe(false)
    expect(isAgentId('')).toBe(false)
    expect(isAgentId(42)).toBe(false)
  })

  it('agentConfig throws for unknown ids', () => {
    expect(() => agentConfig('eve' as 'alice')).toThrow()
  })
})
