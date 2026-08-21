import { config } from 'dotenv'
import { readFileSync } from 'node:fs'

config()

const key = readFileSync('.env', 'utf8').match(/GEMINI_API_KEY=(.*)/)?.[1]?.trim()
if (!key) {
  console.error('No GEMINI_API_KEY in .env')
  process.exit(1)
}

const model = 'gemini-flash-latest'
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
  {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: "You are ASHIR's AI. Reply in exactly one short sentence." }] },
      contents: [{ role: 'user', parts: [{ text: 'Say hello to Ashir.' }] }],
      generationConfig: { temperature: 0.7 }
    })
  }
)

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
    if (line.startsWith('data:')) {
      try {
        const chunk = JSON.parse(line.slice(5))
        const delta =
          chunk.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
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
