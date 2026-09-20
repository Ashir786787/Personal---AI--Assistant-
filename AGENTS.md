# AGENTS.md

Working agreements for AI agents (and humans) editing ASHIR's AI.

## Project in one line

A secure, local-first Windows desktop assistant (Electron + React + TypeScript) — chat/voice in,
Groq/Gemini streaming out, sandboxed file + system actions behind explicit approval gates.

## The task

The task is always the same: make changes, verify real outcomes, and report exactly what happened.
The task is never complete until verification runs: `npm run typecheck && npm run lint && npm test`.

## The plan

One session, one phase, one branch. Always open in Plan mode first, read the relevant
`docs/UI-SPEC.md` sections, then implement against them. Cite the section you are working from.
Every phase ends with the standard REPORT: what was built, how it maps to the spec, what is NOT yet
built, and the manual checklist for the user.

## Rules for purposes of this project

1. The agent cannot see the screen. Work from `docs/UI-SPEC.md`, not from imagination. Cite the
   section number you are implementing.
2. Acceptance criteria are checked with logic tests where possible (reducers, formatters,
   projection math, path-finding) and with a manual checklist written for the user at the end of the
   phase. Never say a UI looks right; say what was built and how the user can verify it.
3. No `dangerouslySetInnerHTML`, no `eval`, no remote fonts, images, scripts, or map tiles. All
   assets are bundled locally (privacy + CSP).
4. Do not change security controls, IPC validation, or the approval gate while doing UI work.
5. No hardcoded fake data anywhere in the UI. Unwired things show an honest "Not connected" state.
6. Ask before adding any dependency (name, purpose, size, alternative without it).
7. Animations pause when the window is hidden and obey reduced motion.
8. Never claim a UI feature works unless it does. Unwired features display honest "coming later" text.
9. Every destructive/mutating action still passes through the existing proposal → approval →
   `action:decide` IPC path. No second path.
10. Privacy wording must be truthful: chat text IS sent to the chosen provider; keys, memory and
    settings stay encrypted on this machine.

## Commands

| Command             | Purpose                               |
| ------------------- | ------------------------------------- |
| `npm run dev`       | Launch the app in development         |
| `npm run build`     | Production build of all three bundles |
| `npm run typecheck` | Strict TypeScript check               |
| `npm run lint`      | ESLint                                |
| `npm test`          | Vitest unit suite                     |
| `npm run format`    | Prettier write                        |
| `npm run keycheck`  | Live validation of both provider keys |

## Conventions

- TypeScript strict. No `any` where avoidable. No comments unless they explain a non-obvious
  safety/security decision.
- UI code lives in `src/renderer/src/`, shared types in `src/shared/`, main process in `src/main/`.
- Reusable primitives live in `src/renderer/src/components/ui/` and are the ONLY place base-level
  styling tokens (from `docs/UI-SPEC.md` section 3) are consumed directly.
- IPC channel names live in `src/shared/ipc.ts`; never string-literal them in handlers.
- Tests: vitest, node environment, `tests/**/*.test.ts`, `@shared` alias available.
- Pre-commit: husky + lint-staged (eslint --fix, prettier) + `scripts/secret-scan.mjs`.
