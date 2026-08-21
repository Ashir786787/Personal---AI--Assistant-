import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'path'
import { app } from 'electron'

const SECRET_PATTERNS = [
  /AIza[0-9A-Za-z_-]{35}/g,
  /AQ\.[A-Za-z0-9_-]{30,}/g,
  /gsk_[A-Za-z0-9]{20,}/g,
  /xai-[A-Za-z0-9]{20,}/g,
  /sk-ant-[A-Za-z0-9_-]{20,}/g
]

export type LogLevel = 'info' | 'warn' | 'error'

let logDir: string | null = null

function ensureLogDir(): string {
  if (!logDir) {
    logDir = join(app.getPath('userData'), 'logs')
    mkdirSync(logDir, { recursive: true })
  }
  return logDir
}

export function redact(text: string): string {
  return SECRET_PATTERNS.reduce((acc, pattern) => acc.replace(pattern, '[REDACTED]'), text)
}

export function log(level: LogLevel, scope: string, message: string): void {
  const line = `${new Date().toISOString()} [${level.toUpperCase()}] (${scope}) ${redact(message)}\n`
  try {
    appendFileSync(join(ensureLogDir(), 'actions.log'), line)
  } catch {
    console.error(`logger write failed: ${scope}`)
  }
}
