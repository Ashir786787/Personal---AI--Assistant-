import type { StreamEvent } from '@shared/chat'
import type { AgentId } from '@shared/agents'
import type { ProviderId } from '@shared/providers'
import { agentConfig } from '@shared/agents'
import { ConversationMemory } from '../conversation/memory'
import { ProviderError } from '../llm/errors'
import type { ChatTurn } from '../llm/provider'
import type { ProviderRouter } from '../llm/router'
import type { ToolRegistry } from './registry'
import { extractToolAction } from './parse'
import { scopedToolUsage } from '../ipc/tool-scope'
import { log } from '../lib/logger'

export type TaskDomain = 'FILES' | 'SYSTEM' | 'ROUTINES' | 'RESEARCH'

const DOMAIN_TO_AGENT: Record<TaskDomain, AgentId> = {
  FILES: 'alice',
  SYSTEM: 'bob',
  ROUTINES: 'carol',
  RESEARCH: 'dave'
}

const DOMAIN_ORDER: TaskDomain[] = ['FILES', 'SYSTEM', 'ROUTINES', 'RESEARCH']

const DOMAIN_TOKENS: Record<TaskDomain, readonly string[]> = {
  FILES: [
    'file',
    'files',
    'folder',
    'folders',
    'downloads',
    'documents',
    'desktop',
    'pictures',
    'organize',
    'organise',
    'rename',
    'a pdf',
    'the pdf',
    'photo',
    'music folder'
  ],
  SYSTEM: [
    'volume',
    'sound',
    'mute',
    'brightness',
    'screen',
    'launch',
    'open spotify',
    'open youtube',
    'open chrome',
    'open edge',
    'browser',
    'webpage',
    'system'
  ],
  ROUTINES: [
    'routine',
    'routines',
    'schedule',
    'scheduled',
    'daily',
    'every day',
    'everyday',
    'auto organize',
    'auto-organize'
  ],
  RESEARCH: [
    'research',
    'investigate',
    'find out',
    'dig through',
    'look up',
    'search for',
    'which file',
    'where is',
    'find my file',
    'is there a file'
  ]
}

const TEAM_HINTS = ['work with your team', 'use your sub', 'sub agent', 'subagent', 'your team']

/** Which agent domains a request touches, in fixed display order. */
export function detectDomains(rawText: string): TaskDomain[] {
  const text = ` ${rawText.toLowerCase()} `
  const found: TaskDomain[] = []
  for (const domain of DOMAIN_ORDER) {
    const tokens = DOMAIN_TOKENS[domain]
    if (tokens.some((token) => text.includes(` ${token} `) || text.includes(token)))
      found.push(domain)
  }
  return found
}

/**
 * A request is "hard" enough to delegate when it spans several agent domains,
 * wants research done, or explicitly asks for the team.
 */
export function isComplexRequest(rawText: string): boolean {
  const text = rawText.toLowerCase()
  if (TEAM_HINTS.some((hint) => text.includes(hint))) return true
  const domains = detectDomains(rawText)
  if (domains.includes('RESEARCH')) return true
  return domains.length >= 2
}

const MAX_AGENT_TURNS = 4
const AGENT_TIMEOUT_MS = 45_000
const MAX_DELEGATED_DOMAINS = 3

export interface AgentReport {
  id: AgentId
  name: string
  text: string
}

export interface DelegateContext {
  router: ProviderRouter
  registry: ToolRegistry
  agentMemories: ReadonlyMap<AgentId, ConversationMemory>
  controller: AbortController
  userText: string
  getApiKey: (provider: ProviderId) => string | undefined
  emit: (event: StreamEvent) => void
}

/**
 * Runs one scoped sub-agent turn: the agent uses only its own tools and its own
 * memory, streams into a private buffer (never the chat panel), and returns a
 * short report. Mutating actions still surface the same proposal gate.
 */
async function runAgentTurn(
  ctx: DelegateContext,
  agentId: AgentId,
  userText: string
): Promise<string> {
  const config = agentConfig(agentId)
  const allowed = new Set(config.tools)
  const memory = ctx.agentMemories.get(agentId) ?? new ConversationMemory()
  memory.append('user', userText)

  const turns: ChatTurn[] = [
    {
      role: 'system',
      content: `${config.systemPrompt}\n\n${scopedToolUsage(ctx.registry.definitionsFor(allowed))}`
    },
    ...memory.recent().map((m) => ({ role: m.role, content: m.content }) as ChatTurn)
  ]

  const failed = new Set<ProviderId>()
  const attempted = new Set<ProviderId>()

  for (let hop = 0; hop < MAX_AGENT_TURNS; hop++) {
    const provider = failed.size > 0 ? ctx.router.pick(Date.now(), [...failed]) : ctx.router.pick()
    const apiKey = ctx.getApiKey(provider.id)
    if (!apiKey) return 'SKIP: no provider key configured'
    attempted.add(provider.id)

    let full = ''
    try {
      const signal = AbortSignal.any([ctx.controller.signal, AbortSignal.timeout(AGENT_TIMEOUT_MS)])
      for await (const chunk of provider.stream({ turns, apiKey, signal })) {
        full += chunk
      }
    } catch (err) {
      const name = (err as Error).name
      if (name === 'AbortError' || name === 'TimeoutError') {
        return 'SKIP: the agent turn timed out or was cancelled'
      }
      if (err instanceof ProviderError) {
        if (err.recoverable && attempted.size < ctx.router.count) {
          if (err.status === 429) ctx.router.markRateLimited(err.provider)
          failed.add(err.provider)
          continue
        }
      }
      const message = err instanceof Error ? err.message : String(err)
      log('warn', 'agent', `${config.name} failed: ${message}`)
      return `AGENT_ERROR: ${message}`
    }

    if (ctx.controller.signal.aborted) return 'SKIP: cancelled by the user'
    if (full.length === 0) {
      if (attempted.size < ctx.router.count) continue
      return 'AGENT_ERROR: provider returned an empty reply'
    }

    const action = extractToolAction(full)
    if (!action) {
      memory.append('assistant', full)
      return full
    }

    let outcome: string
    try {
      outcome = await ctx.registry.execute(action, allowed)
    } catch (err) {
      outcome = `TOOL_ERROR: ${err instanceof Error ? err.message : String(err)}`
    }
    memory.append('user', `TOOL_RESULT for "${action.tool}":\n${outcome}`)
    turns.push({ role: 'assistant', content: full })
    turns.push({
      role: 'user',
      content:
        hop + 1 >= MAX_AGENT_TURNS
          ? `TOOL_RESULT for "${action.tool}" was received. Stop using tools and answer in prose now.`
          : `TOOL_RESULT for "${action.tool}":\n${outcome}`
    })

    if (/confirmation dialog was shown/i.test(outcome)) {
      return `${full}\n\n(approval is pending — a confirmation dialog is open for the user)`
    }
  }
  return 'AGENT_BUDGET: used the step budget and stopped safely'
}

/**
 * For hard multi-part requests, delegates to the town agents, then returns
 * their reports so the supervisor can answer with real evidence.
 */
export async function maybeDelegateComplex(
  ctx: DelegateContext
): Promise<{ handled: boolean; reports: AgentReport[] }> {
  if (!isComplexRequest(ctx.userText)) return { handled: false, reports: [] }

  const domains = detectDomains(ctx.userText).slice(0, MAX_DELEGATED_DOMAINS)
  const reports: AgentReport[] = []
  log('info', 'agent', `delegating to ${domains.join(', ')}`)

  for (const domain of domains) {
    const agentId = DOMAIN_TO_AGENT[domain]
    const config = agentConfig(agentId)
    if (!config.connected) continue
    if (ctx.controller.signal.aborted) break

    ctx.emit({ type: 'agent', name: config.name, state: 'start' })
    const text = await runAgentTurn(ctx, agentId, ctx.userText)
    if (!text.startsWith('SKIP:')) {
      reports.push({ id: agentId, name: config.name, text })
    }
    ctx.emit({ type: 'agent', name: config.name, state: 'done' })
  }

  return { handled: true, reports }
}
