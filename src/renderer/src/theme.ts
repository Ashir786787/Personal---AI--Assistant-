export type ThemeId = 'emerald' | 'cyan' | 'crimson'

export const THEME_IDS: ThemeId[] = ['emerald', 'cyan', 'crimson']

export const THEME_LABEL: Record<ThemeId, string> = {
  emerald: 'Emerald',
  cyan: 'Cyan',
  crimson: 'Crimson'
}

export const THEME_ACCENT: Record<ThemeId, string> = {
  emerald: '#2DD4BF',
  cyan: '#38BDF8',
  crimson: '#F43F5E'
}

export const DEFAULT_THEME: ThemeId = 'emerald'

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as string[]).includes(value)
}

// Authoritative values from docs/UI-SPEC.md section 3.1. The test suite parses
// global.css and asserts the CSS matches this table exactly.
export const THEME_TONE_KEYS = [
  'bg-0',
  'bg-1',
  'bg-2',
  'accent',
  'accent-strong',
  'line',
  'glow',
  'text-1',
  'text-2',
  'text-3',
  'ok',
  'warn',
  'danger'
] as const

export const THEME_TOKENS: Record<ThemeId, Record<(typeof THEME_TONE_KEYS)[number], string>> = {
  emerald: {
    'bg-0': '#070b0f',
    'bg-1': '#0b1116',
    'bg-2': '#111a21',
    accent: '#2dd4bf',
    'accent-strong': '#14b8a6',
    line: 'rgba(45, 212, 191, 0.16)',
    glow: 'rgba(45, 212, 191, 0.35)',
    'text-1': '#e6f1f0',
    'text-2': '#9db2b0',
    'text-3': '#7a8f8d',
    ok: '#34d399',
    warn: '#f59e0b',
    danger: '#f43f5e'
  },
  cyan: {
    'bg-0': '#060a10',
    'bg-1': '#0a1119',
    'bg-2': '#101a26',
    accent: '#38bdf8',
    'accent-strong': '#0ea5e9',
    line: 'rgba(56, 189, 248, 0.16)',
    glow: 'rgba(56, 189, 248, 0.35)',
    'text-1': '#e6eef6',
    'text-2': '#9db0c4',
    'text-3': '#7b8da1',
    ok: '#34d399',
    warn: '#f59e0b',
    danger: '#f43f5e'
  },
  crimson: {
    'bg-0': '#0d0608',
    'bg-1': '#140a0d',
    'bg-2': '#1c0f13',
    accent: '#f43f5e',
    'accent-strong': '#e11d48',
    line: 'rgba(244, 63, 94, 0.16)',
    glow: 'rgba(244, 63, 94, 0.35)',
    'text-1': '#f6e9eb',
    'text-2': '#b7a3a6',
    'text-3': '#8c7a7d',
    ok: '#34d399',
    warn: '#f59e0b',
    danger: '#fb923c'
  }
}

// Maps spec tone keys to the rgb() triplet vars the Tailwind palette consumes.
export const TONE_TO_C_VAR: Partial<Record<(typeof THEME_TONE_KEYS)[number], string>> = {
  'bg-0': 'c-base',
  'bg-1': 'c-panel',
  'bg-2': 'c-panel-raised',
  accent: 'c-accent',
  'accent-strong': 'c-accent-dim',
  'text-1': 'c-ink',
  'text-2': 'c-ink-muted',
  ok: 'c-ok',
  warn: 'c-warn',
  danger: 'c-danger'
}
