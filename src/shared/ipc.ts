import type { SendChatRequest, SendChatResponse, StreamEvent } from './chat'

export const IPC = {
  chatSend: 'chat:send',
  chatCancel: 'chat:cancel',
  chatStream: 'chat:stream',
  statusSnapshot: 'status:snapshot',
  voiceTranscribe: 'voice:transcribe',
  actionProposed: 'action:proposed',
  actionDecide: 'action:decide'
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

export interface AshirsBridge {
  sendChat(request: SendChatRequest): Promise<SendChatResponse>
  cancelChat(): void
  onStreamEvent(listener: (event: StreamEvent) => void): () => void
  transcribeVoice(recording: VoiceRecording): Promise<string>
  onProposal(listener: (proposal: ActionProposal) => void): () => void
  decideProposal(id: string, approved: boolean): Promise<string>
}
