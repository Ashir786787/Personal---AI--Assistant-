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
  settingsSet: 'settings:set'
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
}
