import { config } from 'dotenv'
import { resolve } from 'path'

const envPath = resolve(process.cwd(), '.env')
config({ path: envPath })

export function envKey(name: string): string | undefined {
  const value = process.env[name]
  return value && value.trim().length > 0 ? value.trim() : undefined
}
