import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const PATTERNS = [
  { name: 'Google API key (classic)', regex: /AIza[0-9A-Za-z_-]{35}/ },
  { name: 'Google API key (new format)', regex: /AQ\.[A-Za-z0-9_-]{30,}/ },
  { name: 'Groq API key', regex: /gsk_[A-Za-z0-9]{20,}/ },
  { name: 'xAI API key', regex: /xai-[A-Za-z0-9]{20,}/ },
  { name: 'OpenAI API key', regex: /sk-[A-Za-z0-9T]{20,}/ },
  { name: 'Anthropic API key', regex: /sk-ant-[A-Za-z0-9_-]{20,}/ }
]

const ALLOWED_FILES = new Set(['.env.example', 'scripts/secret-scan.mjs'])

function stagedFiles() {
  const out = execSync('git diff --cached --name-only --diff-filter=ACM', {
    encoding: 'utf8'
  })
  return out.split('\n').map((f) => f.trim()).filter(Boolean)
}

function findSecret(content) {
  for (const { name, regex } of PATTERNS) {
    const match = content.match(regex)
    if (match) return { name, sample: match[0].slice(0, 8) + '...' }
  }
  return null
}

const files = stagedFiles().filter((f) => !ALLOWED_FILES.has(f))
let leaked = false

for (const file of files) {
  let content
  try {
    content = readFileSync(file, 'utf8')
  } catch {
    continue
  }
  const secret = findSecret(content)
  if (secret) {
    console.error(`SECRET DETECTED in ${file}: ${secret.name} (${secret.sample})`)
    leaked = true
  }
}

if (leaked) {
  console.error('Commit blocked. Remove the secret, or rotate the key if it was already exposed.')
  process.exit(1)
}
