import { spawn } from 'node:child_process'

interface AppEntry {
  command: string
  args: string[]
  label: string
}

const APP_WHITELIST: Record<string, AppEntry> = {
  notepad: { command: 'notepad.exe', args: [], label: 'Notepad' },
  calculator: { command: 'calc.exe', args: [], label: 'Calculator' },
  calc: { command: 'calc.exe', args: [], label: 'Calculator' },
  explorer: { command: 'explorer.exe', args: [], label: 'File Explorer' },
  files: { command: 'explorer.exe', args: [], label: 'File Explorer' },
  fileexplorer: { command: 'explorer.exe', args: [], label: 'File Explorer' },
  paint: { command: 'mspaint.exe', args: [], label: 'Paint' },
  edge: { command: 'cmd /c start msedge', args: [], label: 'Microsoft Edge' },
  chrome: { command: 'cmd /c start chrome', args: [], label: 'Google Chrome' },
  vscode: { command: 'code', args: [], label: 'VS Code' },
  code: { command: 'code', args: [], label: 'VS Code' },
  taskmanager: { command: 'taskmgr.exe', args: [], label: 'Task Manager' },
  taskmanager2: { command: 'taskmgr.exe', args: [], label: 'Task Manager' },
  spotify: { command: 'cmd /c start spotify:', args: [], label: 'Spotify' }
}

export function listSupportedApps(): string[] {
  return [...new Set(Object.values(APP_WHITELIST).map((entry) => entry.label))]
}

export function isSupportedApp(name: string): boolean {
  return name.trim().toLowerCase().replace(/\s+/g, '') in APP_WHITELIST
}

export function launchApp(rawName: string): Promise<string> {
  const normalized = rawName.trim().toLowerCase().replace(/\s+/g, '')
  const entry = APP_WHITELIST[normalized]
  if (!entry) {
    return Promise.reject(
      new Error(
        `"${rawName}" is not on the approved app list. Supported: ${listSupportedApps().join(', ')}`
      )
    )
  }

  return new Promise((resolve, reject) => {
    const [shell, flag, target] = entry.command.split(' ')
    if (shell === 'cmd') {
      spawn(shell, [flag ?? '/c', target ?? ''], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      })
        .once('spawn', () => resolve(`${entry.label} launched`))
        .once('error', () => reject(new Error(`Could not launch ${entry.label}`)))
      return
    }

    const child = spawn(entry.command, entry.args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    })
    child.unref()
    resolve(`${entry.label} launched`)
  })
}
