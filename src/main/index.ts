import { join } from 'path'
import { BrowserWindow, Menu, app, protocol, session, shell } from 'electron'
import { IPC } from '@shared/ipc'
import { ConversationMemory } from './conversation/memory'
import { createGeminiProvider } from './llm/gemini'
import { createGroqProvider } from './llm/groq'
import { probePreferredProvider } from './llm/probe'
import { ProviderRouter } from './llm/router'
import { registerChatIpc } from './ipc/chat-handlers'
import { registerVoiceIpc } from './ipc/voice-handlers'
import { registerSettingsIpc } from './ipc/settings-handlers'
import { registerSystemHandlers } from './ipc/system-handlers'
import { registerWakeIpc } from './ipc/wake-handlers'
import { registerWorldIpc } from './ipc/world-handlers'
import { modelFilePath, loadVoskWorkerSource } from './wake/store'
import { createDpapiCipher } from './security/vault'
import { readFileSync, existsSync } from 'node:fs'
import { ToolRegistry } from './tools/registry'
import { isDestructiveProposal, pendingProposalFor } from './tools/proposals'
import { initAutoUpdater } from './updater'
import { startScheduler } from './routines/scheduler'
import { TOWN_AGENTS, type AgentId } from '@shared/agents'
import type { StreamEvent } from '@shared/chat'
import { log } from './lib/logger'

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self' vosk-worker:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self' vosk-model:",
  "font-src 'self' data:"
].join('; ')

// Dev keeps the same rules and adds what the Vite dev server needs: the HMR socket and
// 'unsafe-inline' for Vite's injected bootstrap/preamble scripts (React Fast Refresh writes
// an inline script into index.html, and the app cannot mount without it). The packaged build
// never gets either allowance.
const DEV_CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'",
  "worker-src 'self' vosk-worker:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self' vosk-model: ws: http://localhost:*",
  "font-src 'self' data:"
].join('; ')

// Worker-scoped CSP served with the vosk engine script itself. Emscripten's
// embind layer compiles invoker functions dynamically at runtime, which needs
// 'unsafe-eval' — granted ONLY inside this isolated worker, never the page.
const VOSK_WORKER_CSP = [
  "script-src 'unsafe-eval' 'wasm-unsafe-eval'",
  'connect-src vosk-model: data:'
].join('; ')

function applySecurityPolicy(): void {
  const policy = app.isPackaged ? CSP : DEV_CSP

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [policy] }
    })
  })

  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media')
  })
}

function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 1000,
    minHeight: 640,
    backgroundColor: '#070b0f',
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

  return mainWindow
}

/**
 * Loads the renderer. Kept separate from createMainWindow so all IPC handlers can be
 * registered before the renderer mounts — otherwise the first renderer calls race the
 * startup key probe and fail with "No handler registered".
 */
function loadRenderer(mainWindow: BrowserWindow): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) {
    void mainWindow.loadURL(devUrl)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
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
    },
    {
      scheme: 'vosk-worker',
      privileges: { standard: true, secure: true }
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
      const bytes = readFileSync(file)
      log('info', 'wake', `serving model archive (${Math.round(bytes.length / 1_000_000)} MB)`)
      return new Response(bytes, {
        headers: {
          'Content-Type': 'application/gzip',
          'Content-Length': String(bytes.length)
        }
      })
    })

    protocol.handle('vosk-worker', () => {
      try {
        const source = loadVoskWorkerSource()
        return new Response(source, {
          headers: {
            'Content-Type': 'text/javascript',
            'Content-Length': String(Buffer.byteLength(source)),
            'Content-Security-Policy': VOSK_WORKER_CSP
          }
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'vosk worker unavailable'
        log('error', 'wake', message)
        return new Response(message, { status: 500 })
      }
    })

    const mainWindow = createMainWindow()

    // Register every IPC handler before the renderer is loaded, so its first calls
    // always find a handler. The provider key probe below runs after this and only
    // affects which provider leads, never whether the app works.
    const cipher = createDpapiCipher()
    const memory = new ConversationMemory(join(app.getPath('userData'), 'memory.json'), cipher)
    const agentMemories = new Map<AgentId, ConversationMemory>(
      TOWN_AGENTS.map((agent) => [
        agent.id,
        new ConversationMemory(join(app.getPath('userData'), 'agents', `${agent.id}.json`), cipher)
      ])
    )
    const router = new ProviderRouter([createGeminiProvider(), createGroqProvider()], 'groq')
    const registry = ToolRegistry.withDefaults((draft) => {
      if (mainWindow.isDestroyed()) return
      // The renderer needs the real deadline and the risk class to place the card
      // inline or in the blocking modal, and to stop offering a decision that expired.
      const pending = pendingProposalFor(draft.id)
      mainWindow.webContents.send(IPC.actionProposed, {
        ...draft,
        expiresAt: pending?.expiresAt ?? Date.now(),
        destructive: pending ? isDestructiveProposal(pending.kind) : true
      })
    })
    registerChatIpc(mainWindow.webContents, router, memory, registry, agentMemories)
    registerVoiceIpc(mainWindow.webContents)
    registerSettingsIpc()
    registerSystemHandlers(memory, registry, agentMemories)
    registerWakeIpc(mainWindow.webContents)
    registerWorldIpc()
    initAutoUpdater(mainWindow.webContents)
    startScheduler((summaries) => {
      summaries.forEach((summary, index) => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IPC.chatStream, {
            type: 'tool',
            toolId: `routine-${Date.now().toString(36)}-${index}`,
            name: 'routine',
            argsSummary: summary
          } satisfies StreamEvent)
        }
      })
    })

    loadRenderer(mainWindow)

    // Lead with whichever provider validated at startup: Groq first when its key
    // works (dramatically faster), Gemini first when the Groq key was rejected, so
    // replies never burn a failed round-trip. Re-probed on launch, without blocking startup.
    void probePreferredProvider().then((preferred) => router.setPreferred(preferred))

    log('info', 'app', `started (packaged: ${app.isPackaged})`)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        loadRenderer(createMainWindow())
      }
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
