import type { AshirsBridge } from '@shared/ipc'

declare global {
  interface Window {
    ashirs: AshirsBridge
  }
}

export {}
