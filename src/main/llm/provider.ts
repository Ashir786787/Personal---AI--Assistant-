import type { ProviderId } from '@shared/providers'

export interface ChatTurn {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface StreamRequest {
  turns: ChatTurn[]
  apiKey: string
  signal: AbortSignal
}

export interface LlmProvider {
  readonly id: ProviderId
  readonly model: string
  stream(request: StreamRequest): AsyncGenerator<string>
}
