# ASHIR's AI

A secure, local-first personal desktop assistant for Windows. Talk to it by voice or text; it answers through your choice of free-tier LLM providers, and — in upcoming phases — organizes files, launches apps, and monitors system health on your machine.

Built by M. Ashir Mushtaq.

## Current status: Phase 1 complete

- Real-time chat with streaming responses
- Dual-provider balancing across **Google Gemini** and **Groq** — automatic failover when one provider hits its free limit or has a bad day
- Voice input via Groq Whisper (`whisper-large-v3-turbo`) — transcripts land in the input box for review before sending
- Voice output through Windows speech synthesis
- Hardened Electron shell: sandboxed renderer, strict CSP in packaged builds, navigation lock, single-instance enforcement
- Secrets stay in the main process; API keys are encrypted at rest with Windows DPAPI once stored through the app
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

| Phase | Scope                                            | Status  |
| ----- | ------------------------------------------------ | ------- |
| 0     | Tooling scaffold, security hooks                 | Done    |
| 1     | Chat + voice assistant                           | Done    |
| 2     | File & system automation with confirmation gates | Next    |
| 3     | Browser automation (Playwright)                  | Planned |
| 4     | System monitoring                                | Planned |
| 5     | Multi-agent core                                 | Planned |
| 6     | Agent Town visual (Phaser 3)                     | Planned |
| 7     | Packaging & hardening                            | Planned |

## Safety rules this project follows

1. No destructive action runs without explicit approval shown in plain language.
2. Everything stays local except message text you choose to send to the LLM APIs.
3. No telemetry, no analytics, no phoning home.
4. Keys are never logged, never committed, and scanned for at every git commit by `scripts/secret-scan.mjs`.
