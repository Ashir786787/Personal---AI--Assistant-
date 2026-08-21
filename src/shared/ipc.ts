import type { SendChatRequest, SendChatResponse, StreamEvent } from './chat'

export const IPC = {
  chatSend: 'chat:send',
  chatCancel: 'chat:cancel',
  chatStream: 'chat:stream',
  statusSnapshot: 'status:snapshot'
} as const

export interface AshirsBridge {
  sendChat(request: SendChatRequest): Promise<SendChatResponse>
  cancelChat(): void
  onStreamEvent(listener: (event: StreamEvent) => void): () => void
}
