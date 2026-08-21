import type { ProviderId } from '@shared/providers'

export class ProviderError extends Error {
  readonly provider: ProviderId
  readonly status?: number
  readonly recoverable: boolean

  constructor(
    provider: ProviderId,
    message: string,
    options: { status?: number; recoverable?: boolean } = {}
  ) {
    super(message)
    this.name = 'ProviderError'
    this.provider = provider
    this.status = options.status
    this.recoverable = options.recoverable ?? false
  }
}

export function describeProviderFailure(provider: ProviderId, status: number): ProviderError {
  const name = provider === 'gemini' ? 'Gemini' : 'Groq'
  if (status === 401 || status === 403) {
    return new ProviderError(
      provider,
      `Your ${name} API key was rejected. Check it in Settings or .env`,
      {
        status,
        recoverable: false
      }
    )
  }
  if (status === 429) {
    return new ProviderError(
      provider,
      `${name} free limit reached — switching over so you can keep talking`,
      { status, recoverable: true }
    )
  }
  if (status >= 500) {
    return new ProviderError(
      provider,
      `${name} is having trouble on their end. Try again in a moment`,
      {
        status,
        recoverable: true
      }
    )
  }
  return new ProviderError(provider, `${name} refused the request (${status})`, {
    status,
    recoverable: false
  })
}

export function describeNetworkFailure(provider: ProviderId): ProviderError {
  const name = provider === 'gemini' ? 'Gemini' : 'Groq'
  return new ProviderError(provider, `Could not reach ${name}. Check your internet connection`, {
    recoverable: true
  })
}
