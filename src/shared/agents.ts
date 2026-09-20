export const AGENT_IDS = ['alice', 'bob', 'carol', 'dave'] as const
export type AgentId = (typeof AGENT_IDS)[number]

export function isAgentId(value: unknown): value is AgentId {
  return typeof value === 'string' && (AGENT_IDS as readonly string[]).includes(value)
}

export interface TownAgentConfig {
  id: AgentId
  name: string
  title: string
  domain: string
  /** Exact ToolDefinition.name values this agent may call. Enforced in the main process. */
  tools: readonly string[]
  /** True only when a real tool backend exists for the domain. */
  connected: boolean
  /** Canned local banter shown when the agent is idle. Never sent to an LLM. */
  motto: string
  systemPrompt: string
}

export const TOWN_AGENTS: readonly TownAgentConfig[] = [
  {
    id: 'alice',
    name: 'ALICE',
    title: 'Alice Files',
    domain: 'FILES',
    tools: ['list_folder', 'folder_summary', 'sandbox_overview', 'search_files', 'organize_folder'],
    connected: true,
    motto: 'flattening the Downloads pile',
    systemPrompt: [
      "You are ALICE, ASHIR's file agent living in his Agent Town.",
      'You handle anything about files and folders and use only your file tools.',
      'Be brief and factual. Never name, count or describe a file unless the exact name appears in a TOOL_RESULT.',
      'Propose organizing only when it clearly helps; never invent a plan.'
    ].join(' ')
  },
  {
    id: 'bob',
    name: 'BOB',
    title: 'Bob System',
    domain: 'SYSTEM',
    tools: ['set_volume', 'toggle_mute', 'set_brightness', 'launch_app'],
    connected: true,
    motto: 'keeping your sound and screen in line',
    systemPrompt: [
      "You are BOB, ASHIR's system agent living in his Agent Town.",
      'You handle volume, mute, brightness and launching approved apps, using only your system tools.',
      'Every proposal goes through the normal user confirmation dialog — never claim anything changed until the result says so.'
    ].join(' ')
  },
  {
    id: 'carol',
    name: 'CAROL',
    title: 'Carol Routines',
    domain: 'ROUTINES',
    tools: ['schedule_routine', 'list_routines', 'delete_routine'],
    connected: true,
    motto: 'making chores run themselves',
    systemPrompt: [
      "You are CAROL, ASHIR's routines agent living in his Agent Town.",
      'You schedule, list and remove daily auto-organize routines using only your routine tools.',
      'Confirm exact details with the user before scheduling, and always wait for approval.'
    ].join(' ')
  },
  {
    id: 'dave',
    name: 'DAVE',
    title: 'Dave Research',
    domain: 'RESEARCH',
    tools: [],
    connected: false,
    motto: 'has no research tool yet',
    systemPrompt: [
      "You are DAVE, ASHIR's research agent. You have no tools connected yet, so you cannot accept tasks."
    ].join(' ')
  }
]

export function agentConfig(id: AgentId): TownAgentConfig {
  const found = TOWN_AGENTS.find((agent) => agent.id === id)
  if (!found) throw new Error(`Unknown agent id: ${id}`)
  return found
}
