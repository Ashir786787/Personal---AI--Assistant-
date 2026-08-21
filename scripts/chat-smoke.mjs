import { config } from 'dotenv'
import { readFileSync } from 'node:fs'

config()

const key = readFileSync('.env', 'utf8').match(/GROQ_API_KEY=(.*)/)?.[1]?.trim()
if (!key) {
  console.error('No GROQ_API_KEY in .env')
  process.exit(1)
}

const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
  body: JSON.stringify({
    model: 'openai/gpt-oss-120b',
    messages: [
      { role: 'system', content: "You are ASHIR's AI. Reply in exactly one short sentence." },
      { role: 'user', content: 'Say hello to Ashir.' }
    ],
    stream: true,
    temperature: 0.7
  })
})

if (!response.ok) {
  console.error(`FAILED: ${response.status} ${response.statusText}`)
  console.error(await response.text())
  process.exit(1)
}

process.stdout.write('STREAMING: ')
let text = ''
const reader = response.body.getReader()
const decoder = new TextDecoder()
let buffer = ''

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  buffer += decoder.decode(value, { stream: true })
  let boundary = buffer.indexOf('\n')
  while (boundary !== -1) {
    const line = buffer.slice(0, boundary).trimEnd()
    buffer = buffer.slice(boundary + 1)
    if (line.startsWith('data:') && line.slice(5).trim() !== '[DONE]') {
      try {
        const chunk = JSON.parse(line.slice(5))
        const delta = chunk.choices?.[0]?.delta?.content ?? ''
        text += delta
        process.stdout.write(delta)
      } catch {
        // skip malformed keepalive frames
      }
    }
    boundary = buffer.indexOf('\n')
  }
}

console.log(`\nOK — received ${text.length} chars of streamed response`)
