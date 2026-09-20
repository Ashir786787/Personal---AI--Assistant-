import { useCallback, useEffect, useState } from 'react'

export type MotionSetting = 'auto' | 'reduced'

const STORAGE_KEY = 'ashirs.reduce-motion'

export function isMotionSetting(value: unknown): value is MotionSetting {
  return value === 'auto' || value === 'reduced'
}

export function readMotionSetting(): MotionSetting {
  const raw = localStorage.getItem(STORAGE_KEY)
  return isMotionSetting(raw) ? raw : 'auto'
}

export function writeMotionSetting(next: MotionSetting): void {
  localStorage.setItem(STORAGE_KEY, next)
}

export function systemPrefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false
}

export function resolveReducedMotion(setting: MotionSetting, system: boolean): boolean {
  return setting === 'reduced' || (setting === 'auto' && system)
}

export function useReducedMotion(): {
  reduced: boolean
  setting: MotionSetting
  setSetting: (next: MotionSetting) => void
} {
  const [setting, setSetting] = useState<MotionSetting>(readMotionSetting)
  const [system, setSystem] = useState<boolean>(systemPrefersReducedMotion)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (): void => setSystem(media.matches)
    setSystem(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const update = useCallback((next: MotionSetting): void => {
    setSetting(next)
    writeMotionSetting(next)
  }, [])

  return { reduced: resolveReducedMotion(setting, system), setting, setSetting: update }
}
