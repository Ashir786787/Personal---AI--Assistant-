/**
 * Patches vosk-browser@0.0.8 for strict-CSP environments.
 *
 * The library's embedded Web Worker contains exactly one eval-class construct:
 * an Emscripten dynCall trampoline built with `new Function(...)`. Under a CSP
 * without 'unsafe-eval' that construct throws EvalError and kills model loading
 * silently. This script rewrites it into an equivalent closure (same semantics,
 * no string evaluation) directly inside the base64 worker payload.
 *
 * Idempotent. Runs on every npm install via the package.json "postinstall" hook.
 */
const fs = require('node:fs')
const path = require('node:path')

const NEEDLE =
  'new Function("body","return function "+name+"() {\\n"+' +
  "'    \"use strict\";'+" +
  '"    return body.apply(this, arguments);\\n"+' +
  '"};\\n")(body)'
const REPL =
  '(function(body){return function(){ "use strict"; return body.apply(this, arguments); };})(body)'

function patchSource(src) {
  let count = 0
  while (src.includes(NEEDLE)) {
    src = src.replace(NEEDLE, REPL)
    count++
  }
  return { src, count }
}

const file = path.join(__dirname, '..', 'node_modules', 'vosk-browser', 'dist', 'vosk.js')
if (!fs.existsSync(file)) {
  console.log('patch-vosk: vosk-browser not installed — skipping')
  process.exit(0)
}

let src = fs.readFileSync(file, 'utf8')
let total = 0

const outer = patchSource(src)
src = outer.src
total += outer.count

// Locate the embedded worker payload by its exact call-site markers
// (vosk-browser@0.0.8 emits: createBase64WorkerFactory('<b64>', null, false);)
const marker = "createBase64WorkerFactory('"
const terminator = "', null, false)"
const start = src.indexOf(marker)
if (start >= 0) {
  const from = start + marker.length
  const to = src.indexOf(terminator, from)
  if (to > from) {
    const rawB64 = src.slice(from, to)
    const cleanB64 = rawB64.replace(/[^A-Za-z0-9+/=]/g, '')
    if (/^[A-Za-z0-9+/=]+$/.test(rawB64)) {
      const worker = Buffer.from(cleanB64, 'base64').toString('utf8')
      const inner = patchSource(worker)
      if (inner.count > 0) {
        total += inner.count
        const encoded = Buffer.from(inner.src, 'utf8').toString('base64')
        src = src.slice(0, from) + encoded + src.slice(to)
      }
    } else {
      console.error('patch-vosk: unexpected characters in worker payload — aborting without changes')
    }
  }
}

fs.writeFileSync(file, src)
console.log(`patch-vosk: replaced ${total} eval-class shim(s)`)
