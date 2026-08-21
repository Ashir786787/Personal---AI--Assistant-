import { config } from 'dotenv'
import { existsSync, readFileSync } from 'node:fs'

config()

function loadKeyFromEnvFile(name) {
  if (process.env[name]) return process.env[name]
  if (!existsSync('.env')) return undefined
  const line = readFileSync('.env', 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${name}=`))
  return line?.split('=')[1]?.trim() || undefined
}

async function checkGemini(key) {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
    headers: { 'x-goog-api-key': key }
  })
  if (!res.ok) {
    console.error(`GEMINI: FAILED (${res.status} ${res.statusText})`)
    return false
  }
  const data = await res.json()
  const models = (data.models ?? []).length
  console.log(`GEMINI: OK — ${models} models visible`)
  return true
}

async function checkGroq(key) {
  const res = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${key}` }
  })
  if (!res.ok) {
    console.error(`GROQ: FAILED (${res.status} ${res.statusText})`)
    return false
  }
  const data = await res.json()
  const models = (data.data ?? []).length
  console.log(`GROQ: OK — ${models} models visible`)
  return true
}

const geminiKey = loadKeyFromEnvFile('GEMINI_API_KEY')
const groqKey = loadKeyFromEnvFile('GROQ_API_KEY')

if (!geminiKey || !groqKey) {
  console.error('Missing key(s). Add GEMINI_API_KEY and GROQ_API_KEY to .env')
  process.exit(1)
}

const results = await Promise.all([checkGemini(geminiKey), checkGroq(groqKey)])
process.exit(results.every(Boolean) ? 0 : 1)
