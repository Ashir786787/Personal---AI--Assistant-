import type { SendChatRequest, SendChatResponse, StreamEvent } from './chat'

export const IPC = {
  chatSend: 'chat:send',
  chatCancel: 'chat:cancel',
  chatStream: 'chat:stream',
  statusSnapshot: 'status:snapshot',
  voiceTranscribe: 'voice:transcribe'
} as const

export interface VoiceRecording {
  data: ArrayBuffer
  mime: string
}

export interface AshirsBridge {
  sendChat(request: SendChatRequest): Promise<SendChatResponse>
  cancelChat(): void
  onStreamEvent(listener: (event: StreamEvent) => void): () => void
  transcribeVoice(recording: VoiceRecording): Promise<string>
}
