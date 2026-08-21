import { describe, expect, it } from 'vitest'
import { sseData } from '../../src/main/llm/sse'

function responseFrom(chunks: string[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    }
  })
  return new Response(stream)
}

describe('sseData', () => {
  it('yields each data payload from a well-formed stream', async () => {
    const response = responseFrom(['data: hello\n', 'data: world\n'])
    const payloads: string[] = []
    for await (const payload of sseData(response)) payloads.push(payload)

    expect(payloads).toEqual(['hello', 'world'])
  })

  it('reassembles data lines split across network chunks', async () => {
    const response = responseFrom(['data: gro', 'eted\n\n data', ': ignored\n'])
    const payloads: string[] = []
    for await (const payload of sseData(response)) payloads.push(payload)

    expect(payloads).toEqual(['groeted'])
  })

  it('ignores non-data SSE fields like comments and event names', async () => {
    const response = responseFrom([': keepalive\n', 'event: message\n', 'data: actual\n'])
    const payloads: string[] = []
    for await (const payload of sseData(response)) payloads.push(payload)

    expect(payloads).toEqual(['actual'])
  })

  it('flushes a trailing payload that arrives without a final newline', async () => {
    const response = responseFrom(['data: one\n', 'data: two'])
    const payloads: string[] = []
    for await (const payload of sseData(response)) payloads.push(payload)

    expect(payloads).toEqual(['one', 'two'])
  })
})
