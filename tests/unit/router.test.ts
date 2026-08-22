import { describe, expect, it } from 'vitest'
import type { LlmProvider } from '../../src/main/llm/provider'
import { ProviderError } from '../../src/main/llm/errors'
import { ProviderRouter } from '../../src/main/llm/router'

function fakeProvider(id: 'gemini' | 'groq'): LlmProvider {
  return {
    id,
    model: `model-${id}`,
    // eslint-disable-next-line require-yield
    async *stream() {
      return
    }
  }
}

describe('ProviderRouter', () => {
  it('starts with the preferred provider', () => {
    const router = new ProviderRouter([fakeProvider('gemini'), fakeProvider('groq')], 'gemini')
    expect(router.pick().id).toBe('gemini')
  })

  it('never returns an excluded provider while another is available', () => {
    const router = new ProviderRouter([fakeProvider('gemini'), fakeProvider('groq')], 'gemini')
    for (let i = 0; i < 10; i++) {
      expect(router.pick(1000 + i, ['gemini']).id).toBe('groq')
    }
  })

  it('throws unrecoverable error when every non-excluded provider is gone', () => {
    const router = new ProviderRouter([fakeProvider('gemini'), fakeProvider('groq')], 'gemini')
    try {
      router.pick(Date.now(), ['gemini', 'groq'])
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError)
      expect((err as ProviderError).recoverable).toBe(false)
    }
  })

  it('throws unrecoverable error when exclusions exhaust every provider', () => {
    const router = new ProviderRouter([fakeProvider('gemini'), fakeProvider('groq')], 'gemini')
    try {
      router.pick(Date.now(), ['gemini', 'groq'])
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError)
      expect((err as ProviderError).recoverable).toBe(false)
    }
  })

  it('balances load across providers within the usage window', () => {
    const router = new ProviderRouter([fakeProvider('gemini'), fakeProvider('groq')], 'gemini')

    const first = router.pick(1000)
    const second = router.pick(1100)
    const third = router.pick(1200)

    expect(first.id).toBe('gemini')
    expect(second.id).toBe('groq')
    expect(third.id).toBe('gemini')
  })

  it('excludes a rate-limited provider until its cooldown expires', () => {
    const router = new ProviderRouter([fakeProvider('gemini'), fakeProvider('groq')], 'gemini')
    router.markRateLimited('gemini', 30_000, 1000)

    expect(router.pick(2000).id).toBe('groq')
    expect(router.pick(3000).id).toBe('groq')
    expect(router.pick(31_500).id).toBe('gemini')
  })

  it('throws a recoverable error when every provider is cooling down', () => {
    const router = new ProviderRouter([fakeProvider('gemini'), fakeProvider('groq')], 'gemini')
    router.markRateLimited('gemini', 20_000)
    router.markRateLimited('groq', 40_000)

    try {
      router.pick(21_000)
      expect.unreachable('pick should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError)
      expect((err as ProviderError).recoverable).toBe(true)
      expect((err as Error).message).toMatch(/cooling down/i)
    }
  })

  it('reports the total provider count for failover decisions', () => {
    const router = new ProviderRouter([fakeProvider('gemini'), fakeProvider('groq')], 'groq')
    expect(router.count).toBe(2)
  })
})
