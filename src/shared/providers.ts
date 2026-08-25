export type ProviderId = 'gemini' | 'groq'

export interface ModelInfo {
  id: string
  label: string
}

export const PROVIDER_MODELS: Record<ProviderId, ModelInfo> = {
  gemini: { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  groq: { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B (Groq)' }
}
