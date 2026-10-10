import { useEffect, useState } from 'react'

/** True while the window is hidden or minimized, so animations can be parked. */
export function useWindowHidden(): boolean {
  const [hidden, setHidden] = useState(() => document.hidden)

  useEffect(() => {
    const onChange = (): void => setHidden(document.hidden)
    document.addEventListener('visibilitychange', onChange)
    window.addEventListener('blur', onChange)
    window.addEventListener('focus', onChange)
    return () => {
      document.removeEventListener('visibilitychange', onChange)
      window.removeEventListener('blur', onChange)
      window.removeEventListener('focus', onChange)
    }
  }, [])

  return hidden
}
