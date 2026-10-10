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

| #   | Destination                                    | When                                                                                             | Data sent                                | Never sent                |
| --- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------- | ------------------------- |
| 1   | `api.groq.com`                                 | chat (primary) + STT (voice)                                                                     | the message text you send; audio for STT | files you never mentioned |
| 2   | `generativelanguage.googleapis.com`            | chat (primary or failover)                                                                       | the message text you send                | keys of other providers   |
| 3   | `github.com` / `objects.githubusercontent.com` | update check + download (electron-updater); wake-word model download (one time, on first enable) | version metadata; the model archive      | anything else             |

Nothing else. No telemetry, no analytics, no crash reporting endpoints.

Message text is genuinely sent to whichever provider answers, and the app says so
in the chat empty state and in Settings. File contents reach a provider only when
they are part of the text you send or a tool result the assistant chose to
summarize into its reply; the app never uploads a file on its own.

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
- CSP notes: the Kaldi worker is **not** a blob any more. `scripts/patch-vosk.cjs`
  (postinstall) extracts vosk-browser's embedded worker source and redirects
  worker creation to `vosk-worker://local/kaldi.js`, a protocol handler in the
  main process that serves that one file with its own **worker-scoped CSP**
  (`script-src 'unsafe-eval' 'wasm-unsafe-eval'; connect-src vosk-model: data:`).
  This is required because Emscripten's embind layer compiles invoker functions
  dynamically at runtime (`craftInvokerFunction`), which cannot be statically
  rewritten. The `'unsafe-eval'` grant therefore applies ONLY inside this
  isolated speech worker — the renderer page CSP stays strict: no `unsafe-eval`
  anywhere, `worker-src 'self' vosk-worker:` (no blob:), `connect-src 'self'
vosk-model:`. Embedded fonts load via `font-src 'self' data:`. The dynCall
  shim that used plain `new Function(...)` is still rewritten at install time
  into an equivalent closure for defense in depth.
  The same page CSP is applied in **development** too. Dev adds exactly two
  allowances the Vite dev server cannot work without: `ws:` / `http://localhost:*`
  in `connect-src` for HMR, and `'unsafe-inline'` in `script-src` for Vite's
  injected bootstrap and React Fast Refresh preamble (without it the app cannot
  mount, per `@vitejs/plugin-react can't detect preamble` in the log). Neither
  allowance exists in a packaged build — the shipped policy still forbids inline
  script, remote fonts, and any remote origin.
- Worker source location: in development it is read from
  `node_modules/vosk-browser/dist/ashirs-kaldi-worker.js`; in a packaged build
  `node_modules` is not shipped, so `extraResources` copies the same file to
  `resources/vosk/` and the main process reads it from `process.resourcesPath`.
  If neither exists the failure is an explicit error, never a silent fallback.

- Phrase matching (`src/renderer/src/lib/wake-phrases.ts`) is pure string math
  on partial transcripts; nothing is recorded or transmitted while waiting for
  the wake phrase. Only after the phrase fires does normal (user-initiated)
  STT to Groq begin.

## Data at rest

| File                | Location                               | Protection                                                                                                                                                                                                                              |
| ------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Conversation memory | `%APPDATA%/ashirs-ai/memory.json`      | **DPAPI-encrypted envelope** (`version 3`, Windows CryptProtectData via Electron safeStorage). Plaintext never touches disk; if encryption is unavailable the session stays RAM-only. Old plaintext formats are auto-discarded on load. |
| Agent memories      | `%APPDATA%/ashirs-ai/agents/<id>.json` | same DPAPI envelope, one store per town agent (alice, bob, carol, dave)                                                                                                                                                                 |
| Settings            | `%APPDATA%` settings store             | DPAPI-encrypted via safeStorage                                                                                                                                                                                                         |
| Routines            | `routines.json`                        | plaintext JSON (name, approved absolute folder, time — no message content)                                                                                                                                                              |
| Action log          | `logs/actions.log`                     | plaintext, secret-pattern redaction enforced in logger; tool arguments are logged through the same redacting summarizer the UI uses, so file content never reaches the log                                                              |
| API keys            | `.env` beside app                      | gitignored, read only by main process, never serialized over IPC, regex-redacted if they ever reach logs                                                                                                                                |

Uninstall keeps `%APPDATA%/ashirs-ai` (`deleteAppDataOnUninstall: false`). The
in-app **Delete all my data** button is the deliberate erase path, and it clears
the main transcript _and_ all four agent memories, reporting per-store failures
instead of claiming a clean wipe.

## Mutation safety

- Every mutating action is proposed → shown in plain language → executed only on
  explicit approval → followed by a ground-truth SYSTEM ACTION REPORT so the
  assistant cannot claim false success.
- Proposals expire after **5 minutes**. The renderer shows a live countdown and
  drops the card; the main process refuses the decision even if a stale card
  were still around.
- Non-destructive proposals (organize, schedule, volume, brightness, launch)
  appear inline in the chat with a count, the first 10 detail lines and a queue
  indicator. Irreversible ones (write, delete, delete routine) use a blocking
  modal instead.
- The originating agent is bound to the proposal. On approval the main process
  re-checks that the action's tool is still inside that agent's toolkit, so a
  tampered or replayed decision cannot exceed the agent's scope.
- Execution re-validates at the last moment: protected paths (Discord, WhatsApp,
  VS Code, system folders) are refused again inside the executor, and a delete
  is refused if the target is no longer the same kind of thing (file vs folder)
  that the user actually approved.
- Routines store the exact absolute folder that was approved, and the scheduler
  re-resolves it and re-checks it at fire time.
- Tool cards and logs never echo file content: `summarizeArgs` replaces the
  `content` argument with a character count.
- Read-only tools (folder search, summaries, system stats) run without approval.

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
