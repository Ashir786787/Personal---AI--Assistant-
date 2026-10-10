import { homedir } from 'node:os'

const OMITTED_KEYS = new Set(['content'])
const MAX_VALUE_CHARS = 120

function escapeRegExp(value: string): string {
  return value.replace(/[\\/^$*+?.()|[\]{}]/g, '\\$&')
}

/** Home directory becomes "~" so tool cards never echo the user's full username. */
export function shortenPaths(value: string): string {
  const home = homedir()
  const withTilde =
    home.length > 0 ? value.replace(new RegExp(escapeRegExp(home), 'gi'), '~') : value
  return withTilde.replace(/\\+/g, '\\')
}

function clip(value: string): string {
  return value.length > MAX_VALUE_CHARS ? `${value.slice(0, MAX_VALUE_CHARS)}…` : value
}

function describeValue(key: string, value: unknown): string {
  if (OMITTED_KEYS.has(key)) {
    const text = typeof value === 'string' ? value : (JSON.stringify(value) ?? '')
    return `[${text.length} chars omitted]`
  }
  if (value === null || value === undefined) return String(value)
  if (typeof value === 'object') {
    const serialized = JSON.stringify(value)
    return serialized === undefined ? 'unsupported value' : clip(shortenPaths(serialized))
  }
  return clip(shortenPaths(String(value)))
}

export function summarizeArgs(args: Record<string, unknown>): string {
  const parts = Object.entries(args).map(([key, value]) => `${key}=${describeValue(key, value)}`)
  return parts.join(' · ')
}
