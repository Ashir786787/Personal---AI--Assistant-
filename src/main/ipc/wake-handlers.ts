import { ipcMain, type WebContents } from 'electron'
import { IPC, type WakeModelStateInfo } from '@shared/ipc'
import { getWakeState, onWakeModelState, startWakeModelDownload } from '../wake/store'

function toPublic(info: ReturnType<typeof getWakeState>): WakeModelStateInfo {
  const base: WakeModelStateInfo = { state: info.state }
  if (info.percent !== undefined) base.percent = info.percent
  if (info.error !== undefined) base.error = info.error
  if (info.url !== undefined) base.url = info.url
  return base
}

export function registerWakeIpc(webContents: WebContents): void {
  ipcMain.handle(IPC.wakeModelState, (): WakeModelStateInfo => toPublic(getWakeState()))

  ipcMain.handle(IPC.wakeModelStart, () => {
    void startWakeModelDownload()
  })

  onWakeModelState((info) => {
    if (!webContents.isDestroyed()) {
      webContents.send(IPC.wakeModelProgress, toPublic(info))
    }
  })
}
