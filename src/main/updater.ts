import { app, ipcMain, type WebContents } from 'electron'
import electronUpdater from 'electron-updater'
import { IPC, type UpdateStatus } from '@shared/ipc'
import { log } from './lib/logger'

const CHECK_INTERVAL_MS = 30 * 60 * 1000

const { autoUpdater } = electronUpdater

export interface UpdateController {
  check(): void
  install(): void
}

export function initAutoUpdater(webContents: WebContents): UpdateController {
  let lastStatus: UpdateStatus = { status: 'idle' }

  const emit = (status: UpdateStatus): void => {
    lastStatus = status
    if (!webContents.isDestroyed()) {
      webContents.send(IPC.updateStatus, status)
    }
    if (status.status === 'error') {
      log('warn', 'update', status.message)
    } else if (status.status !== 'idle' && status.status !== 'checking') {
      log('info', 'update', `status=${status.status}`)
    }
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => emit({ status: 'checking' }))
  autoUpdater.on('update-available', (info) =>
    emit({ status: 'available', version: info.version ?? '' })
  )
  autoUpdater.on('update-not-available', () => emit({ status: 'not-available' }))
  autoUpdater.on('download-progress', (progress) =>
    emit({ status: 'downloading', percent: Math.round(progress.percent ?? 0) })
  )
  autoUpdater.on('update-downloaded', (info) =>
    emit({ status: 'ready', version: info.version ?? '' })
  )
  autoUpdater.on('error', (err) =>
    emit({
      status: 'error',
      message:
        err instanceof Error
          ? `Update check failed: ${err.message}`
          : 'Update check failed. Releases may not be published yet'
    })
  )

  ipcMain.handle(IPC.updateCheck, () => {
    void autoUpdater.checkForUpdates().catch(() => {
      /* error event already reports */
    })
  })
  ipcMain.handle(IPC.updateVersion, () => app.getVersion())
  ipcMain.handle(IPC.updateInstall, () => {
    autoUpdater.quitAndInstall(false, true)
  })

  // initial snapshot for late-mounting renderer
  webContents.once('did-finish-load', () => {
    emit(lastStatus)
  })

  if (app.isPackaged) {
    setTimeout(() => {
      void autoUpdater.checkForUpdates().catch(() => {
        /* handled by error event */
      })
    }, 5000)
    setInterval(() => {
      void autoUpdater.checkForUpdates().catch(() => {
        /* handled by error event */
      })
    }, CHECK_INTERVAL_MS)
  } else {
    log('info', 'update', 'dev mode — update checks disabled')
  }

  return {
    check: () => {
      void autoUpdater.checkForUpdates().catch(() => {
        /* handled by error event */
      })
    },
    install: () => autoUpdater.quitAndInstall(false, true)
  }
}
