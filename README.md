# ASHIR's AI

A secure, local-first personal desktop assistant for Windows. Talk to it by voice or text; it answers through your choice of free-tier LLM providers, and — in upcoming phases — organizes files, launches apps, and monitors system health on your machine.

Built by M. Ashir Mushtaq.

## Current status: v1.5.14 — daily-driver ready

- Real-time chat with streaming responses, a Stop button mid-answer, and Regenerate on the last turn
- Markdown answers (lists, code fences with Copy, links) rendered as React elements — no `dangerouslySetInnerHTML`
- Dual-provider balancing across **Google Gemini** and **Groq** — automatic failover when one provider hits its free limit or has a bad day
- Voice input via Groq Whisper (`whisper-large-v3-turbo`) — transcripts land in the input box for review before sending
- Voice output through Windows speech synthesis
- An Agent Town of four specialists (Alice files, Bob system, Carol routines, Dave research) that run real tools inside their own scope; Dave shows **Not connected** because his path is not wired yet
- Daily tidy routines that resolve and re-validate the exact approved folder at fire time
- Hardened Electron shell: sandboxed renderer, strict CSP in packaged _and_ development builds, navigation lock, single-instance enforcement
- Secrets stay in the main process; API keys are encrypted at rest with Windows DPAPI once stored through the app
- **Delete all my data** in Settings erases the chat and all four agent memories, and reports exactly what it wiped
- Reduce-motion switch that honors the Windows setting by default
- Append-only action log with automatic secret redaction

## Requirements

- Windows 10/11 (64-bit)
- Node.js 20+
- An API key from at least one of:
  - [Google AI Studio](https://aistudio.google.com/apikey) (Gemini)
  - [Groq Console](https://console.groq.com) (Groq)

Both have free tiers. The app balances load between whichever keys you provide.

## Setup

```bash
npm install
```

Create a `.env` file in the project root (never committed):

```
GEMINI_API_KEY=your_key_here
GROQ_API_KEY=your_key_here
```

Verify both keys with one cheap call each:

```bash
npm run keycheck
```

Run the app:

```bash
npm run dev
```

A desktop window opens. Type a message or click the mic.

> Note: `localhost:5173` shown in the terminal is only Vite's build server. The actual app is the desktop window titled "ASHIR's AI".

## Scripts

| Command                         | Purpose                                  |
| ------------------------------- | ---------------------------------------- |
| `npm run dev`                   | Launch the app in development            |
| `npm run build`                 | Production build of all three bundles    |
| `npm run typecheck`             | Strict TypeScript check                  |
| `npm run lint`                  | ESLint                                   |
| `npm test`                      | Vitest unit suite                        |
| `npm run keycheck`              | Live validation of both provider keys    |
| `node scripts/chat-smoke.mjs`   | End-to-end streaming test against Groq   |
| `node scripts/gemini-smoke.mjs` | End-to-end streaming test against Gemini |

## Architecture

```
┌───────────────────────────────────────────────┐
│                Electron Shell                 │
│                                               │
│  Renderer (React, sandboxed)                  │
│   chat UI · voice recorder · status bar       │
│        ▲  typed IPC bridge (3+1 channels)     │
│        ▼                                      │
│  Main process (Node.js)                       │
│   provider router ──► Gemini / Groq adapters  │
│   conversation memory · encrypted key store   │
│   redacting action logger                     │
└───────────────────────────────────────────────┘
```

Key decisions:

- The renderer never sees API keys or makes network calls; the preload bridge exposes a minimal typed surface.
- The provider router spreads requests evenly across healthy providers within a rolling window, benches rate-limited ones, and fails over mid-conversation without losing your message.
- Conversation context trims to the last 20 messages before every call to conserve free quota.
- Every destructive-action feature planned for later phases must pass through an explicit human confirmation gate — enforced as a UX rule, not a suggestion.

## Roadmap

| Phase | Scope                                            | Status |
| ----- | ------------------------------------------------ | ------ |
| 0     | Tooling scaffold, security hooks                 | Done   |
| 1     | Chat + voice assistant                           | Done   |
| 2     | File & system automation with confirmation gates | Done   |
| 3     | System controls, settings, packaging, updates    | Done   |
| 4     | Scheduled routines                               | Done   |
| 5     | Release automation, signing hooks                | Done   |
| 6     | Conversation persistence — **v1.0**              | Done   |
| 7     | Agent Town, wake word, world monitor, **v1.5**   | Done   |

v1.5 highlights: the Agent Town, an on-device wake word, the world monitor, Stop
and Regenerate in the chat, Markdown answers, a proposal queue with a five-minute
approval window, honest memory counts, and a real "Delete all my data" wipe.

Not yet built: Dave's research path (shown as Not connected rather than faked),
deeper long-term memory beyond transcripts, screen awareness, and code signing on
the installer.

## Releases and auto-updates

1. Bump `version` in `package.json`.
2. Commit, tag, push:

   ```powershell
   git tag v0.2.0
   git push origin main v0.2.0
   ```

3. GitHub Actions builds the NSIS installer on a clean runner, runs all gates,
   and publishes the exe plus `latest.yml` to the matching GitHub Release.
4. Installed apps check that release feed on launch, download silently in the
   background, and offer "Restart now" when ready.

Code signing is wired but optional: add `CSC_LINK` and `CSC_KEY_PASSWORD`
secrets to this repository and electron-builder signs every artifact during the
release build. Without them the installer stays unsigned (SmartScreen warning
appears once per new version).

Note: the update feed requires the GitHub repository to be public (or a token
on the client). Decide before publishing whether this repo goes public.

Uninstalling leaves `%APPDATA%/ashirs-ai` in place (`deleteAppDataOnUninstall`
is deliberately `false`), so transcripts and keys are not destroyed by accident.
Use **Settings → Delete all my data** to erase them on purpose.

## Safety rules this project follows

1. No destructive action runs without explicit approval shown in plain language.
2. Everything stays local except message text you choose to send to the LLM APIs.
3. No telemetry, no analytics, no phoning home.
4. Keys are never logged, never committed, and scanned for at every git commit by `scripts/secret-scan.mjs`.
