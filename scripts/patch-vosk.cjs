/**
 * Patches vosk-browser@0.0.8 for strict-CSP environments.
 *
 * Stage 1 rewrites the Emscripten dynCall trampoline (`new Function(...)`)
 * inside/outside the embedded worker payload into an equivalent closure.
 * Stage 2 extracts the worker source to dist/ashirs-kaldi-worker.js and
 * redirects worker creation to vosk-worker:// so the main process can serve
 * it with a worker-scoped CSP (embind's craftInvokerFunction needs dynamic
 * code compilation and cannot be statically rewritten).
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

/**
 * Second stage — redirect worker creation through the vosk-worker:// protocol.
 *
 * Even with the dynCall shims above rewritten, Emscripten's embind layer builds
 * invoker functions dynamically at runtime (craftInvokerFunction passes
 * `Function` around by reference, e.g. `new_(Function, args1)`), which a strict
 * page CSP always blocks. Rather than chase every site, we serve the worker
 * script from its own protocol handler whose RESPONSE carries a worker-scoped
 * CSP permitting dynamic code inside that isolated worker only. The page CSP
 * stays strict.
 *
 * This extracts the decoded worker source to dist/ashirs-kaldi-worker.js
 * (read by the main process at runtime), replaces the entire
 * createBase64WorkerFactory(...) call expression with a tiny constructible
 * shim pointing at the protocol URL, and patches any remaining eval-class
 * constructs inside the extracted worker for defense in depth.
 */
const OUT_SHIM =
  '(function(){return function(){return new Worker("vosk-worker://local/kaldi.js")}})()'
const WORKER_OUT = path.join(path.dirname(file), 'ashirs-kaldi-worker.js')

const mStart = src.indexOf(marker)
if (mStart < 0) {
  if (!src.includes('vosk-worker://')) {
    console.error('patch-vosk: worker factory call site not found — vosk-browser layout changed?')
    process.exit(1)
  }
  console.log('patch-vosk: already redirected to vosk-worker:// protocol')
} else {
  const from = mStart + marker.length
  const to = src.indexOf(terminator, from)
  if (!(to > from)) {
    console.error('patch-vosk: worker factory terminator not found — aborting without changes')
    process.exit(1)
  }
  const rawB64 = src.slice(from, to)
  if (!/^[A-Za-z0-9+/=]+$/.test(rawB64)) {
    console.error('patch-vosk: unexpected characters in worker payload — aborting without changes')
    process.exit(1)
  }
  const inner = patchSource(Buffer.from(rawB64, 'base64').toString('utf8'))
  total += inner.count
  fs.writeFileSync(WORKER_OUT, inner.src)
  src = src.slice(0, mStart) + OUT_SHIM + src.slice(to + terminator.length)
  fs.writeFileSync(file, src)
  console.log(`patch-vosk: emitted ${path.basename(WORKER_OUT)} (${Math.round(inner.src.length / 1_000_000)} MB)`)
  console.log('patch-vosk: worker creation redirected to vosk-worker:// protocol')
}

console.log(`patch-vosk: done — ${total} eval-class shim(s) neutralized`)
