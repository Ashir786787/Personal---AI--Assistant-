import { ipcMain } from 'electron'
import { IPC, type ProviderKeyStatus } from '@shared/ipc'
import type { ProviderId } from '@shared/providers'
import { getApiKey, setApiKey } from '../settings/store'
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
}
