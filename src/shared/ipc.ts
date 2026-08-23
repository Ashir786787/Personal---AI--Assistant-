import type { SendChatRequest, SendChatResponse, StreamEvent } from './chat'

export const IPC = {
  chatSend: 'chat:send',
  chatCancel: 'chat:cancel',
  chatClear: 'chat:clear',
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
  memorySummary: 'memory:summary'
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
}

export interface ProviderKeyStatus {
  gemini: boolean
  groq: boolean
}

export type UpdateStatus =
  | { status: 'idle' }
  | { status: 'checking' }
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
}

export interface AshirsBridge {
  sendChat(request: SendChatRequest): Promise<SendChatResponse>
  cancelChat(): void
  clearChat(): Promise<void>
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
}
