import { join } from 'path'
import { pathToFileURL } from 'url'
import { BrowserWindow, Menu, app, net, protocol, session, shell } from 'electron'
import { IPC } from '@shared/ipc'
import { ConversationMemory } from './conversation/memory'
import { createGeminiProvider } from './llm/gemini'
import { createGroqProvider } from './llm/groq'
import { ProviderRouter } from './llm/router'
import { registerChatIpc } from './ipc/chat-handlers'
import { registerVoiceIpc } from './ipc/voice-handlers'
import { registerSettingsIpc } from './ipc/settings-handlers'
import { registerSystemHandlers } from './ipc/system-handlers'
import { registerWakeIpc } from './ipc/wake-handlers'
import { modelFilePath } from './wake/store'
import { createDpapiCipher } from './security/vault'
import { existsSync } from 'node:fs'
import { ToolRegistry } from './tools/registry'
import { initAutoUpdater } from './updater'
import { startScheduler } from './routines/scheduler'
import type { StreamEvent } from '@shared/chat'
import { log } from './lib/logger'

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "font-src 'self'"
].join('; ')

function applySecurityPolicy(): void {
  if (!app.isPackaged) {
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
      callback(permission === 'media')
    })
    return
  }

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [CSP] } })
  })

  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media')
  })
}

function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 820,
    minHeight: 560,
    backgroundColor: '#0A0E12',
    title: "ASHIR's AI",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    mainWindow.focus()
    mainWindow.flashFrame(true)
  })

  mainWindow.webContents.on('preload-error', (_event, path, error) => {
    log('error', 'preload', `${path}: ${error.message}`)
  })
  mainWindow.webContents.on('did-fail-load', (_event, code, description, url) => {
    log('error', 'window', `failed to load ${url}: ${code} ${description}`)
  })
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 2) log('warn', 'renderer', `${message} (${sourceId}:${line})`)
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault())

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) {
    void mainWindow.loadURL(devUrl)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.enableSandbox()

  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'vosk-model',
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
    }
  ])

  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null)
    applySecurityPolicy()

    protocol.handle('vosk-model', () => {
      const file = modelFilePath()
      if (!existsSync(file)) {
        return new Response('wake model not downloaded yet', { status: 404 })
      }
      return net.fetch(pathToFileURL(file).toString())
    })

    const mainWindow = createMainWindow()

    const router = new ProviderRouter([createGeminiProvider(), createGroqProvider()], 'gemini')
    const memory = new ConversationMemory(
      join(app.getPath('userData'), 'memory.json'),
      createDpapiCipher()
    )
    const registry = ToolRegistry.withDefaults((proposal) => {
      if (!mainWindow.isDestroyed()) mainWindow.webContents.send(IPC.actionProposed, proposal)
    })
    registerChatIpc(mainWindow.webContents, router, memory, registry)
    registerVoiceIpc(mainWindow.webContents)
    registerSettingsIpc()
    registerSystemHandlers(memory, registry)
    registerWakeIpc(mainWindow.webContents)
    initAutoUpdater(mainWindow.webContents)
    startScheduler((summaries) => {
      for (const summary of summaries) {
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IPC.chatStream, {
            type: 'tool',
            name: 'routine',
            argsSummary: summary
          } satisfies StreamEvent)
        }
      }
    })

    log('info', 'app', `started (packaged: ${app.isPackaged})`)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
