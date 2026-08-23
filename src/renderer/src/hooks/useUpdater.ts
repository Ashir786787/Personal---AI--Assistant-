import { useCallback, useEffect, useState } from 'react'
import type { UpdateStatus } from '@shared/ipc'

export function useUpdater(): {
  status: UpdateStatus
  check: () => void
  install: () => void
} {
  const [status, setStatus] = useState<UpdateStatus>({ status: 'idle' })

  useEffect(() => {
    const unsubscribe = window.ashirs.onUpdateStatus(setStatus)
    return unsubscribe
  }, [])

  const check = useCallback((): void => {
    void window.ashirs.checkForUpdates()
  }, [])

  const install = useCallback((): void => {
    void window.ashirs.installUpdate()
  }, [])

  return { status, check, install }
}

export function updateLabel(status: UpdateStatus): string | null {
  switch (status.status) {
    case 'available':
      return `UPDATE ${status.version}`
    case 'downloading':
      return `${status.percent}%`
    case 'ready':
      return 'READY'
    default:
      return null
  }
}
