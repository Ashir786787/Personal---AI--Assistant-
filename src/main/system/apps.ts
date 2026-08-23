import { spawn } from 'node:child_process'

export interface AppEntry {
  command: string
  args: string[]
  label: string
  browser?: boolean
}

const BASE_APPS: AppEntry[] = [
  { command: 'notepad.exe', args: [], label: 'Notepad' },
  { command: 'calc.exe', args: [], label: 'Calculator' },
  { command: 'explorer.exe', args: [], label: 'File Explorer' },
  { command: 'mspaint.exe', args: [], label: 'Paint' },
  { command: 'cmd', args: ['/c', 'start', 'msedge'], label: 'Microsoft Edge', browser: true },
  { command: 'cmd', args: ['/c', 'start', 'chrome'], label: 'Google Chrome', browser: true },
  { command: 'cmd', args: ['/c', 'start', '', 'code'], label: 'VS Code' },
  { command: 'taskmgr.exe', args: [], label: 'Task Manager' },
  { command: 'cmd', args: ['/c', 'start', 'spotify:'], label: 'Spotify' }
]

const SHORT_ALIASES: Record<string, string> = {
  calc: 'Calculator',
  files: 'File Explorer',
  fileexplorer: 'File Explorer',
  edge: 'Microsoft Edge',
  msedge: 'Microsoft Edge',
  chrome: 'Google Chrome',
  googlechrome: 'Google Chrome',
  vscode: 'VS Code',
  code: 'VS Code',
  taskmgr: 'Task Manager'
}

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '')
}

const APP_WHITELIST: Record<string, AppEntry> = {}
for (const entry of BASE_APPS) {
  APP_WHITELIST[normalize(entry.label)] = entry
}
for (const [alias, label] of Object.entries(SHORT_ALIASES)) {
  const target = APP_WHITELIST[normalize(label)]
  if (target) APP_WHITELIST[alias] = target
}

const SAFE_URL = /^https?:\/\/[A-Za-z0-9\-._~:/?#[\]@!$&()*+,;=%]+$/

export function listSupportedApps(): string[] {
  return [...new Set(BASE_APPS.map((entry) => entry.label))]
}

export function resolveApp(rawName: string): AppEntry | null {
  return APP_WHITELIST[normalize(rawName)] ?? null
}

export function isSupportedApp(name: string): boolean {
  return resolveApp(name) !== null
}

export function sanitizeUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const url = raw.trim()
  if (url.length === 0 || url.length > 2048) return null
  if (!SAFE_URL.test(url)) return null
  if (/%(?![0-9A-Fa-f]{2})/.test(url)) return null
  return url
}

function spawnArgs(entry: AppEntry, url: string | null): { file: string; args: string[] } {
  if (!url) return { file: entry.command, args: [...entry.args] }
  return { file: 'cmd', args: ['/c', 'start', '', entry.args[2] ?? '', url] }
}

export function launchApp(rawName: string, rawUrl?: unknown): Promise<string> {
  const entry = resolveApp(rawName)
  if (!entry) {
    return Promise.reject(
      new Error(
        `"${rawName}" is not on the approved app list. Supported: ${listSupportedApps().join(', ')}`
      )
    )
  }

  let url: string | null = null
  if (rawUrl !== undefined && rawUrl !== null && String(rawUrl).length > 0) {
    if (!entry.browser) {
      return Promise.reject(new Error(`"${entry.label}" cannot open web addresses`))
    }
    url = sanitizeUrl(rawUrl)
    if (!url) {
      return Promise.reject(
        new Error('That web address looked unsafe, so I refused it. Use a normal https:// link')
      )
    }
  }

  return new Promise((resolve, reject) => {
    const { file, args } = spawnArgs(entry, url)
    const child = spawn(file, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    })
    child.once('spawn', () => {
      child.unref()
      resolve(url ? `${entry.label} opened ${url}` : `${entry.label} launched`)
    })
    child.once('error', () => reject(new Error(`Could not launch ${entry.label}`)))
  })
}
