import type { ToolAction } from '@shared/tools'

export function extractToolAction(text: string): ToolAction | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidates: string[] = []
  if (fenced?.[1]) candidates.push(fenced[1].trim())

  const bare = text.match(/\{[\s\S]*\}/)
  if (bare?.[0]) candidates.push(bare[0])

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as { tool?: unknown; args?: unknown }
      if (typeof parsed.tool === 'string' && parsed.tool.length > 0) {
        return {
          tool: parsed.tool,
          args:
            typeof parsed.args === 'object' && parsed.args !== null
              ? (parsed.args as Record<string, unknown>)
              : {}
        }
      }
    } catch {
      continue
    }
  }
  return null
}
