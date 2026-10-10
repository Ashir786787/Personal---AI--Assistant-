import type { RegenerateChatResponse, SendChatRequest, SendChatResponse, StreamEvent } from './chat'
import type { FeedBatch } from './feed'
import type { ProviderId } from './providers'

export const IPC = {
  chatSend: 'chat:send',
  chatRegenerate: 'chat:regenerate',
  chatCancel: 'chat:cancel',
  chatClear: 'chat:clear',
  chatClearAll: 'chat:clear-all',
  chatStream: 'chat:stream',
  statusSnapshot: 'status:snapshot',
  voiceTranscribe: 'voice:transcribe',
  actionProposed: 'action:proposed',
  actionDecide: 'action:decide',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  updateStatus: 'update:status',
  updateCheck: 'update:check',
  updateInstall: 'update:install',
  updateVersion: 'update:version',
  toolsList: 'tools:list',
  systemStats: 'system:stats',
  memorySummary: 'memory:summary',
  wakeModelState: 'wake:model-state',
  wakeModelStart: 'wake:model-start',
  wakeModelProgress: 'wake:model-progress',
  feedFetch: 'feed:fetch',
  feedOpenExternal: 'feed:open'
} as const

export interface VoiceRecording {
  data: ArrayBuffer
  mime: string
}

export interface ActionProposal {
  id: string
  title: string
  detailLines: string[]
  totalMoves: number
  /** After this the main process refuses the decision and the user must be asked again. */
  expiresAt: number
  /** Destructive actions use the blocking modal; the rest stay inline in the chat. */
  destructive: boolean
}

/** What a tool builds; the main process adds the deadline and the risk class. */
export type ProposalCardDraft = Omit<ActionProposal, 'expiresAt' | 'destructive'>

export interface ProviderKeyStatus {
  gemini: boolean
  groq: boolean
}

export type UpdateStatus =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'not-available' }
  | { status: 'dev' }
  | { status: 'available'; version: string }
  | { status: 'downloading'; percent: number }
  | { status: 'ready'; version: string }
  | { status: 'error'; message: string }

export interface SkillEntry {
  name: string
  description: string
}

export interface SystemStats {
  cpuPercent: number
  ramPercent: number
  ramUsedGb: number
  ramTotalGb: number
  batteryPercent: number | null
  diskFreeGb: number | null
  diskTotalGb: number | null
  uptimeHours: number
}

export interface MemorySummary {
  messageCount: number
  oldestAt: number | null
  /** Main transcript plus every town agent's own memory, so the UI cannot overstate it. */
  agentMessageCount: number
  storeCount: number
}

export interface ClearAllResult {
  cleared: string[]
  failed: string[]
}

export interface WakeModelStateInfo {
  state: 'missing' | 'downloading' | 'ready' | 'error'
  percent?: number
  error?: string
  url?: string
}

// Real provider status for the top bar (spec 4.1). "cooling" means the router
// rate-limited it and is backing off; nothing here is estimated.
export type ProviderHealth = { id: ProviderId; state: 'ok' | 'cooling' }

export interface StatusSnapshot {
  providers: ProviderHealth[]
  agents: { working: number; total: number }
}

export interface AshirsBridge {
  sendChat(request: SendChatRequest): Promise<SendChatResponse>
  regenerateChat(): Promise<RegenerateChatResponse | null>
  cancelChat(): void
  clearChat(): Promise<void>
  clearAllMemory(): Promise<ClearAllResult>
  onStreamEvent(listener: (event: StreamEvent) => void): () => void
  transcribeVoice(recording: VoiceRecording): Promise<string>
  onProposal(listener: (proposal: ActionProposal) => void): () => void
  decideProposal(id: string, approved: boolean): Promise<string>
  getKeyStatus(): Promise<ProviderKeyStatus>
  setProviderKey(provider: 'gemini' | 'groq', key: string): Promise<void>
  onUpdateStatus(listener: (status: UpdateStatus) => void): () => void
  checkForUpdates(): Promise<void>
  installUpdate(): Promise<void>
  getVersion(): Promise<string>
  listSkills(): Promise<SkillEntry[]>
  systemStats(): Promise<SystemStats>
  memorySummary(): Promise<MemorySummary>
  getStatusSnapshot(): Promise<StatusSnapshot>
  getWakeModelState(): Promise<WakeModelStateInfo>
  startWakeModelDownload(): Promise<void>
  onWakeModelProgress(listener: (info: WakeModelStateInfo) => void): () => void
  fetchFeeds(sources: string[]): Promise<FeedBatch>
  openExternalIfHttps(url: string): Promise<void>
}
