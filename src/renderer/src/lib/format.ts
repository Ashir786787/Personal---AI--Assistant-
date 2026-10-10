export function formatElapsedMs(elapsedMs: number): string {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return '0s'
  if (elapsedMs < 1000) return `${Math.round(elapsedMs)}ms`
  return `${(elapsedMs / 1000).toFixed(1)}s`
}

/** Keeps tool cards compact: the root is dropped and only the last few segments show. */
export function shortenPathLabel(input: string, segments = 3): string {
  const trimmed = input.trim()
  if (trimmed === '') return ''
  const parts = trimmed.split(/[\\/]+/).filter(Boolean)
  const rooted = /^[/\\]/.test(trimmed) || /^[A-Za-z]:[\\/]/.test(trimmed)
  const body = rooted && parts.length > 1 ? parts.slice(1) : parts
  if (body.length <= segments) return body.join('\\')
  return `…${body.slice(-segments).join('\\')}`
}
