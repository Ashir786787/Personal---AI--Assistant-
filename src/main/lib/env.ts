import { config } from 'dotenv'
import { existsSync } from 'node:fs'
import { join, resolve } from 'path'
import { app } from 'electron'

function loadEnv(): void {
  const candidates = [resolve(process.cwd(), '.env'), join(app.getAppPath(), '.env')]
  for (const path of candidates) {
    if (existsSync(path)) {
      config({ path })
      return
    }
  }
}

loadEnv()

export function envKey(name: string): string | undefined {
  const value = process.env[name]
  return value && value.trim().length > 0 ? value.trim() : undefined
}
