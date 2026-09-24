import type { ProviderId } from '@shared/providers'
import { getApiKey } from '../settings/store'

const PROBE_TIMEOUT_MS = 5000

const GROQ_MODELS = 'https://api.groq.com/openai/v1/models'
const GEMINI_MODELS = 'https://generativelanguage.googleapis.com/v1beta/models'

async function probeEndpoint(url: string, headers: Record<string, string>): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
    })
    return response.ok
  } catch {
    return false
  }
}

async function probeProvider(id: ProviderId): Promise<boolean> {
  const key = getApiKey(id)
  if (!key) return false
  if (id === 'groq') {
    return probeEndpoint(GROQ_MODELS, { authorization: `Bearer ${key}` })
  }
  return probeEndpoint(`${GEMINI_MODELS}?key=${encodeURIComponent(key)}`, {})
}

/**
 * Pick the provider to lead with at startup. Groq stays first when its key is
 * healthy (dramatically faster), but a key that was rejected (401) burns a
 * failed round-trip on every reply, so Gemini leads in that case. Re-evaluated
 * on every launch, so fixing the Groq key restores Groq-first automatically.
 */
export async function probePreferredProvider(): Promise<ProviderId> {
  const checks = await Promise.all(
    (['groq', 'gemini'] as const).map(async (id) => ({ id, ok: await probeProvider(id) }))
  )
  return checks.find((check) => check.ok)?.id ?? 'groq'
}
