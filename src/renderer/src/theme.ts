export type ThemeId = 'ion' | 'crimson' | 'emerald'

export const THEME_IDS: ThemeId[] = ['ion', 'crimson', 'emerald']

export const THEME_LABEL: Record<ThemeId, string> = {
  ion: 'Ion',
  crimson: 'Crimson',
  emerald: 'Emerald'
}

export const THEME_ACCENT: Record<ThemeId, string> = {
  ion: '#4CE0D2',
  crimson: '#F87171',
  emerald: '#34D399'
}

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as string[]).includes(value)
}
