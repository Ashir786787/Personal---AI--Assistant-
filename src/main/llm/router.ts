import type { ProviderId } from '@shared/providers'
import { ProviderError } from './errors'
import type { LlmProvider } from './provider'

const USAGE_WINDOW_MS = 60_000

export class ProviderRouter {
  private readonly providers: Map<ProviderId, LlmProvider>
  private readonly order: ProviderId[]
  private readonly cooldownUntil = new Map<ProviderId, number>()
  private readonly usageTimestamps = new Map<ProviderId, number[]>()

  constructor(providers: LlmProvider[], preferred: ProviderId) {
    this.providers = new Map(providers.map((p) => [p.id, p]))
    const rest = providers.map((p) => p.id).filter((id) => id !== preferred)
    this.order = [preferred, ...rest]
  }

  availableIds(now = Date.now()): ProviderId[] {
    return this.order.filter((id) => (this.cooldownUntil.get(id) ?? 0) <= now)
  }

  pick(now = Date.now(), exclude: ProviderId[] = []): LlmProvider {
    const cooling = this.availableIds(now)
    if (cooling.length === 0) {
      const soonest = Math.min(...this.order.map((id) => this.cooldownUntil.get(id) ?? 0))
      const waitSeconds = Math.max(1, Math.ceil((soonest - now) / 1000))
      throw new ProviderError(
        'gemini',
        `Both free limits are cooling down. Try again in ${waitSeconds}s`,
        { recoverable: true }
      )
    }

    const usable = cooling.filter((id) => !exclude.includes(id))
    if (usable.length === 0) {
      throw new ProviderError(
        'gemini',
        'Every provider failed for that request. Please try again in a moment',
        { recoverable: false }
      )
    }

    const leastUsed = [...usable].sort((a, b) => this.usageCount(a, now) - this.usageCount(b, now))
    const chosen = leastUsed[0] as ProviderId
    this.recordUsage(chosen, now)
    return this.providers.get(chosen)!
  }

  get count(): number {
    return this.providers.size
  }

  markRateLimited(id: ProviderId, retryAfterMs = 30_000, now = Date.now()): void {
    this.cooldownUntil.set(id, now + retryAfterMs)
  }

  private usageCount(id: ProviderId, now: number): number {
    const stamps = (this.usageTimestamps.get(id) ?? []).filter((t) => now - t < USAGE_WINDOW_MS)
    this.usageTimestamps.set(id, stamps)
    return stamps.length
  }

  private recordUsage(id: ProviderId, now: number): void {
    const stamps = this.usageTimestamps.get(id) ?? []
    stamps.push(now)
    this.usageTimestamps.set(id, stamps)
  }
}
