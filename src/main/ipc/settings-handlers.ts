import { ipcMain } from 'electron'
import { IPC, type ProviderKeyStatus } from '@shared/ipc'
import type { ProviderId } from '@shared/providers'
import { getApiKey, setApiKey, getWakeKey, setWakeKey } from '../settings/store'
import { log } from '../lib/logger'

const VALID_PROVIDERS: ProviderId[] = ['gemini', 'groq']

export function registerSettingsIpc(): void {
  ipcMain.handle(IPC.settingsGet, (): ProviderKeyStatus => ({
    gemini: Boolean(getApiKey('gemini')),
    groq: Boolean(getApiKey('groq'))
  }))

  ipcMain.handle(IPC.settingsSet, (_event, raw: unknown) => {
    const provider = (raw as { provider?: unknown })?.provider
    const key = String((raw as { key?: unknown })?.key ?? '').trim()
    if (!VALID_PROVIDERS.includes(provider as ProviderId)) {
      throw new Error('Unknown provider')
    }
    if (key.length === 0) throw new Error('Key is empty')
    setApiKey(provider as ProviderId, key)
    log('info', 'settings', `api key saved for ${String(provider)} (encrypted store)`)
  })

  ipcMain.handle(IPC.wakeGet, (): string | null => getWakeKey() ?? null)

  ipcMain.handle(IPC.wakeSet, (_event, raw: unknown) => {
    const key = String(raw ?? '').trim()
    if (key.length === 0) throw new Error('Key is empty')
    setWakeKey(key)
    log('info', 'settings', 'wake-word access key saved (encrypted store)')
  })
}
