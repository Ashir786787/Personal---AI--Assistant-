export type ProviderId = 'gemini' | 'groq'

export interface ModelInfo {
  id: string
  label: string
}

export const PROVIDER_MODELS: Record<ProviderId, ModelInfo> = {
  gemini: { id: 'gemini-flash-latest', label: 'Gemini Flash' },
  groq: { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Groq)' }
}
