import { describe, expect, it } from 'vitest'
import { describeNetworkFailure, describeProviderFailure } from '../../src/main/llm/errors'

describe('describeProviderFailure', () => {
  it('treats a rejected key as non-recoverable and points at the key', () => {
    const error = describeProviderFailure('gemini', 401)
    expect(error.recoverable).toBe(false)
    expect(error.message).toMatch(/key was rejected/i)
  })

  it('treats rate limits as recoverable and explains the failover', () => {
    const error = describeProviderFailure('groq', 429)
    expect(error.provider).toBe('groq')
    expect(error.status).toBe(429)
    expect(error.recoverable).toBe(true)
    expect(error.message).toMatch(/free limit/i)
  })

  it('treats server errors as the provider having a bad day', () => {
    const error = describeProviderFailure('gemini', 503)
    expect(error.recoverable).toBe(true)
    expect(error.message).toMatch(/their end/i)
  })

  it('never leaks raw status codes as the whole message', () => {
    const error = describeProviderFailure('groq', 400)
    expect(error.message).not.toBe('400')
    expect(error.message.length).toBeGreaterThan(10)
  })
})

describe('describeNetworkFailure', () => {
  it('blames the connection, not the user', () => {
    const error = describeNetworkFailure('gemini')
    expect(error.recoverable).toBe(true)
    expect(error.message).toMatch(/internet connection/i)
  })
})
