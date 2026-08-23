import { useCallback, useEffect, useState } from 'react'
import { isThemeId, THEME_IDS, type ThemeId } from '../theme'

const STORAGE_KEY = 'ashirs.theme'

export function useTheme(): {
  theme: ThemeId
  setTheme: (theme: ThemeId) => void
  cycleTheme: () => void
} {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isThemeId(stored) ? stored : 'ion'
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const setTheme = useCallback((next: ThemeId): void => {
    setThemeState(next)
  }, [])

  const cycleTheme = useCallback((): void => {
    setThemeState((prev) => THEME_IDS[(THEME_IDS.indexOf(prev) + 1) % THEME_IDS.length] ?? 'ion')
  }, [])

  return { theme, setTheme, cycleTheme }
}
