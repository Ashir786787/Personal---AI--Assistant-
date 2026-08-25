import { PROVIDER_MODELS } from '@shared/providers'
import { describeNetworkFailure, describeProviderFailure } from './errors'
import type { LlmProvider, StreamRequest } from './provider'
import { sseData } from './sse'

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'

interface GeminiChunk {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
    finishReason?: string
  }>
  error?: { code?: number; message?: string }
}

function buildBody(request: StreamRequest): string {
  const systemParts = request.turns.filter((t) => t.role === 'system').map((t) => t.content)
  const contents = request.turns
    .filter((t) => t.role !== 'system')
    .map((t) => ({
      role: t.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: t.content }]
    }))

  return JSON.stringify({
    contents,
    ...(systemParts.length > 0 && {
      systemInstruction: { parts: [{ text: systemParts.join('\n\n') }] }
    }),
    generationConfig: { temperature: 0.7, maxOutputTokens: 8192 }
  })
}

export function createGeminiProvider(model = PROVIDER_MODELS.gemini.id): LlmProvider {
  return {
    id: 'gemini',
    model,

    async *stream(request: StreamRequest) {
      let response: Response
      try {
        response = await fetch(`${ENDPOINT}/${model}:streamGenerateContent?alt=sse`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-goog-api-key': request.apiKey
          },
          body: buildBody(request),
          signal: request.signal
        })
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        throw describeNetworkFailure('gemini')
      }

      if (!response.ok) throw describeProviderFailure('gemini', response.status)

      for await (const payload of sseData(response)) {
        if (payload === '[DONE]') break
        let chunk: GeminiChunk
        try {
          chunk = JSON.parse(payload) as GeminiChunk
        } catch {
          continue
        }
        if (chunk.error?.code) throw describeProviderFailure('gemini', chunk.error.code)
        const text = chunk.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
        if (text) yield text
      }
    }
  }
}
