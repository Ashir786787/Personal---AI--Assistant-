import electronUpdater from 'electron-updater'
import { app, dialog } from 'electron'
import { log } from './lib/logger'

const { autoUpdater } = electronUpdater

export function initAutoUpdater(): void {
  if (!app.isPackaged) {
    log('info', 'updater', 'skipped in dev')
    return
  }

  autoUpdater.logger = null
  autoUpdater.autoDownload = true

  autoUpdater.on('update-downloaded', async (info) => {
    log('info', 'updater', `update downloaded: ${info.version}`)
    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: "ASHIR's AI — Update Ready",
      message: `Version ${info.version} is ready to install.`,
      detail: 'Restart the app now to apply the update, or keep using this session.',
      buttons: ['Restart now', 'Later'],
      defaultId: 0
    })
    if (response === 0) {
      setImmediate(() => {
        autoUpdater.quitAndInstall()
      })
    }
  })

  autoUpdater.on('error', (err) => {
    log('warn', 'updater', `check failed: ${err.message}`)
  })

  autoUpdater.checkForUpdates().catch((err: unknown) => {
    log(
      'warn',
      'updater',
      `initial check failed: ${err instanceof Error ? err.message : String(err)}`
    )
  })
}
