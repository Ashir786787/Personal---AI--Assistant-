const fs = require('node:fs')
const s = fs.readFileSync('node_modules/vosk-browser/dist/vosk.js', 'utf8')
console.log('vosk.js len', s.length)
console.log('has factory call:', s.includes('createBase64WorkerFactory'))
console.log('has shim:', s.includes('vosk-worker://local/kaldi.js'))
new Function(s) // throws if unparseable
console.log('vosk.js parses OK')

const w = fs.readFileSync('node_modules/vosk-browser/dist/ashirs-kaldi-worker.js', 'utf8')
console.log('worker len', w.length)
console.log('| new Function:', (w.match(/new\s*Function\s*\(/g) || []).length)
console.log('| bare Function(:', (w.match(/[^\w.$]Function\s*\(/g) || []).length)
console.log('| eval(:', (w.match(/[^\w.$]eval\s*\(/g) || []).length)
console.log('| new_(Function:', w.includes('new_(Function'))
try {
  new Function(w)
  console.log('worker parses OK')
} catch (e) {
  console.log('WORKER PARSE FAIL', e.message)
}
