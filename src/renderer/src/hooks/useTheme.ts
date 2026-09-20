import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_THEME, isThemeId, THEME_IDS, type ThemeId } from '../theme'

const STORAGE_KEY = 'ashirs.theme'

export function useTheme(): {
  theme: ThemeId
  setTheme: (theme: ThemeId) => void
  cycleTheme: () => void
} {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isThemeId(stored) ? stored : DEFAULT_THEME
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const setTheme = useCallback((next: ThemeId): void => {
    setThemeState(next)
  }, [])

  const cycleTheme = useCallback((): void => {
    setThemeState(
      (prev) => THEME_IDS[(THEME_IDS.indexOf(prev) + 1) % THEME_IDS.length] ?? DEFAULT_THEME
    )
  }, [])

  return { theme, setTheme, cycleTheme }
}
