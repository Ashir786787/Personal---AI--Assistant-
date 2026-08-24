# ASHIR's AI — Security Model

Living threat model. Every outbound connection, every byte at rest, every trust
boundary is listed here. Phase H (Security Audit) validates this document against
the code line-by-line before any messaging capability ships.

## Trust boundaries

```
┌────────────────────────────────────────────────────────────┐
│ RENDERER (React UI)                                        │
│  • sandbox: true, contextIsolation: true, nodeIntegration: │
│    false — zero Node/Electron APIs                         │
│  • No API keys. No direct network access (CSP connect-src  │
│    'self'). Talks ONLY through the preload bridge.         │
└───────────────┬────────────────────────────────────────────┘
                │ typed IPC channels only (@shared/ipc.ts)
┌───────────────▼────────────────────────────────────────────┐
│ MAIN PROCESS (trusted core)                                │
│  • Holds API keys (.env, never bundled into asar)          │
│  • All LLM calls, all fs access, all shell execution       │
│  • All mutations pass the approval gate                    │
└───────────────┬────────────────────────────────────────────┘
                │ HTTPS only
┌───────────────▼────────────────────────────────────────────┐
│ EXTERNAL SERVICES                                          │
└────────────────────────────────────────────────────────────┘
```

## Outbound connections (complete list)

| #   | Destination                                    | When                                                                                             | Data sent                                                                | Never sent                        |
| --- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | --------------------------------- |
| 1   | `api.groq.com`                                 | STT (voice), chat fallback                                                                       | audio / prompt text                                                      | file contents not in conversation |
| 2   | `generativelanguage.googleapis.com`            | Gemini chat + vision (Phase B)                                                                   | prompt text; screenshot ONLY when user explicitly asks a screen question | keys of other providers           |
| 3   | `github.com` / `objects.githubusercontent.com` | update check + download (electron-updater); wake-word model download (one time, on first enable) | version metadata; the model archive                                      | anything else                     |

Nothing else. No telemetry, no analytics, no crash reporting endpoints.

## Wake word (Vosk — on-device)

- Engine: `vosk-browser` (Apache-2.0), Kaldi running as WebAssembly inside a
  Web Worker. **Audio is transcribed entirely on this PC** — the mic stream
  never leaves the process.
- The model archive (`wake-model-en-v1.tar.gz`) is downloaded once from our own
  GitHub release over HTTPS and **SHA-256-pinned** in `src/main/wake/store.ts`;
  a checksum mismatch discards the file before it is ever used.
- The archive is served to the worker through a local `vosk-model://` protocol
  that only ever maps to the single downloaded file under
  `%APPDATA%/ashirs-ai/wake/`.
- CSP notes: `worker-src 'self' blob:` is required because vosk-browser builds
  its Kaldi worker from an inlined base64 blob (no remote script); the blob
  inherits this same CSP. `connect-src vosk-model: data:` allows only that
  local protocol plus inline `data:` payloads — needed because the WASM engine
  itself is embedded as a data URI (same for embedded fonts via `font-src`).
  No http(s) origin beyond `'self'` and the pinned GitHub model release was
  added. `script-src` includes `'wasm-unsafe-eval'` — the narrow CSP3 source
  that permits WebAssembly compilation only (Kaldi runs as WASM), not general
  `eval()`. The library's single eval-based shim is rewritten at install time
  by `scripts/patch-vosk.cjs` into an equivalent closure, so plain string
  evaluation stays forbidden.
- Phrase matching (`src/renderer/src/lib/wake-phrases.ts`) is pure string math
  on partial transcripts; nothing is recorded or transmitted while waiting for
  the wake phrase. Only after the phrase fires does normal (user-initiated)
  STT to Groq begin.

## Data at rest

| File                | Location                          | Protection                                                                                                                                                                                                                              |
| ------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Conversation memory | `%APPDATA%/ashirs-ai/memory.json` | **DPAPI-encrypted envelope** (`version 3`, Windows CryptProtectData via Electron safeStorage). Plaintext never touches disk; if encryption is unavailable the session stays RAM-only. Old plaintext formats are auto-discarded on load. |
| Settings            | `%APPDATA%` settings store        | DPAPI-encrypted via safeStorage                                                                                                                                                                                                         |
| Routines            | `routines.json`                   | plaintext JSON (names/folder/time only — no message content)                                                                                                                                                                            |
| Action log          | `logs/actions.log`                | plaintext, secret-pattern redaction enforced in logger                                                                                                                                                                                  |
| API keys            | `.env` beside app                 | gitignored, read only by main process, never serialized over IPC, regex-redacted if they ever reach logs                                                                                                                                |

## Mutation safety

- Every destructive action (file moves/deletes, process kills, app launches,
  volume/brightness changes) is proposed → shown in an amber Approve/Cancel
  dialog → executed only on explicit approval → followed by a ground-truth
  SYSTEM ACTION REPORT so the assistant cannot claim false success.
- Read-only tools (web search, system stats) run without approval.

## Screen Awareness contract (Phase B — to be implemented)

1. Screenshots exist only in RAM inside the main process.
2. Sent exclusively to endpoint #2 above, over HTTPS, only when invoked.
3. Renderer receives text analysis only — never pixel data.
4. Visible indicator during capture; Settings kill switch; rate limit 1/10s;
   every capture logged.

## Update pipeline

Tag-driven GitHub Actions builds signed-less NSIS installers and publishes a
GitHub release; electron-updater verifies downloads against `latest.yml` SHA512
before install.
