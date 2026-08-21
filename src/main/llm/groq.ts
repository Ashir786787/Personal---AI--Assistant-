import { PROVIDER_MODELS } from '@shared/providers'
import { describeNetworkFailure, describeProviderFailure } from './errors'
import type { ChatTurn, LlmProvider, StreamRequest } from './provider'
import { sseData } from './sse'

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'

interface OpenAiChunk {
  choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }>
  error?: { message?: string; code?: number | string }
}

function toMessages(turns: ChatTurn[]): Array<{ role: string; content: string }> {
  return turns.map((t) => ({ role: t.role, content: t.content }))
}

export function createGroqProvider(model = PROVIDER_MODELS.groq.id): LlmProvider {
  return {
    id: 'groq',
    model,

    async *stream(request: StreamRequest) {
      let response: Response
      try {
        response = await fetch(ENDPOINT, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${request.apiKey}`
          },
          body: JSON.stringify({
            model,
            messages: toMessages(request.turns),
            stream: true,
            temperature: 0.7
          }),
          signal: request.signal
        })
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        throw describeNetworkFailure('groq')
      }

      if (!response.ok) throw describeProviderFailure('groq', response.status)

      for await (const payload of sseData(response)) {
        if (payload === '[DONE]') break
        let chunk: OpenAiChunk
        try {
          chunk = JSON.parse(payload) as OpenAiChunk
        } catch {
          continue
        }
        if (chunk.error?.code) {
          const status = typeof chunk.error.code === 'number' ? chunk.error.code : 500
          throw describeProviderFailure('groq', status)
        }
        const text = chunk.choices?.[0]?.delta?.content ?? ''
        if (text) yield text
      }
    }
  }
}
