# UI-SPEC.md — ASHIR's AI interface specification

Working spec for the Stonic-style redesign. Sections are cited from implementation tasks
(UI-0 … UI-6). This document is the source of truth for every change; do not design from memory.

**Honest framing:** Stonic runs the AI on servers behind a subscription. ASHIR's AI uses your own
provider keys. That is better for cost control, but it means all privacy wording MUST describe the
cloud calls truthfully: chat text IS sent to the chosen provider.

---

## 3. Design system (all original values)

### 3.1 Themes

Three themes, switched live, stored in settings, applied with a `data-theme` attribute on the root
element and CSS variables. Default = **emerald** (matches the current look).

| Token             | Emerald                | Cyan                   | Crimson               |
| ----------------- | ---------------------- | ---------------------- | --------------------- |
| `--bg-0` (app)    | `#070B0F`              | `#060A10`              | `#0D0608`             |
| `--bg-1` (panel)  | `#0B1116`              | `#0A1119`              | `#140A0D`             |
| `--bg-2`          | `#111A21`              | `#101A26`              | `#1C0F13`             |
| `--accent`        | `#2DD4BF`              | `#38BDF8`              | `#F43F5E`             |
| `--accent-strong` | `#14B8A6`              | `#0EA5E9`              | `#E11D48`             |
| `--line`          | `rgba(45,212,191,.16)` | `rgba(56,189,248,.16)` | `rgba(244,63,94,.16)` |
| `--glow`          | `rgba(45,212,191,.35)` | `rgba(56,189,248,.35)` | `rgba(244,63,94,.35)` |
| `--text-1`        | `#E6F1F0`              | `#E6EEF6`              | `#F6E9EB`             |
| `--text-2`        | `#9DB2B0`              | `#9DB0C4`              | `#B7A3A6`             |
| `--text-3`        | `#7A8F8D`              | `#7B8DA1`              | `#8C7A7D`             |

Shared tokens (all themes): `--ok #34D399`, `--warn #F59E0B`, `--danger #F43F5E`. In the crimson
theme `--danger` uses `#FB923C` so errors stay distinguishable from the accent.

### 3.2 Type

Keep the current sans for body text and a monospace for caps labels. Fonts are bundled locally (no
Google Fonts CDN — privacy and CSP). Scale:

11 (caps label, letter-spacing `.14em`) / 12 (nav) / 13 (secondary) / 14 (body) / 16 (chat) /
20 and 24 (titles) / 32 (hero). **Nothing below 11px.**

`--text-2` and `--text-3` must keep at least 4.5:1 contrast on their panel for every theme.

### 3.3 Space and shape

- 4px grid: 4, 8, 12, 16, 24, 32.
- Radii 8 / 12 / 16 / pill.
- Panels: `--bg-1` at 80% opacity, 1px `--line` border, faint inner glow.
- Focus ring: 2px `--accent`, 2px offset, visible on every interactive element.

### 3.4 Motion

Durations 120 / 200 / 320 ms, ease-out. Under `prefers-reduced-motion` (and the in-app "Reduce
motion" setting): no particle drift, no line animation, fades only.

### 3.5 Primitives

Build once and reuse, under `src/renderer/src/components/ui/`:

Button (primary, ghost, danger) · IconButton · Panel · Chip · Badge · Toggle · Tabs · Modal ·
SlideOver · Toast · Tooltip · ProgressRing.

These primitives are the ONLY place base-level styling tokens are consumed directly.

---

## 4. Layout specs

Minimum window **1000×640**. Above that, the chat panel is **380–520 px** wide and the stage takes
the rest.

### 4.1 Shell

```
┌ title bar 32px ─────────────────────────────────────────────────────────────┐
├ TOP BAR 48px: ● ASHIR'S AI   [status pill]      MIC · AGENTS n/4 · AI PROVIDER · ◐ · ⚙ ┤
├ RAIL 88px ┬ STAGE (flex) ─────────────────────────────┬ CHAT 380–520px ─────┤
│ ◉ Core    │                                            │                     │
│ ▦ Town    │   (active view renders here)               │                     │
│ ◍ World   │                                            │                     │
│ ▤ System  │                                            │                     │
└───────────┴────────────────────────────────────────────┴─────────────────────┘
```

- Rail items: icon 22px + label 11px caps, min hit area 64×64, active item has accent border and
  glow, tooltip with the full name.
- Top bar items are plain words with a state dot and tooltip. "MIC" shows READY / LIVE / DENIED.
  "AGENTS n/4" shows the working count. Replace "LINK READY" with the provider name and health,
  e.g. "GROQ ● OK" or "GEMINI ● RATE-LIMITED". The unlabeled toggle becomes a labeled power switch
  "AI ON/OFF" (same as Start AI).

### 4.2 Core view

```
                    [ MEMORY ]
                  12 facts · open
                       │
  [ SKILLS ]──────────◉ ORB ──────────[ SOUL ]
  9 tools · open     (particles)      Warm · Direct
                       │
                   [ SETTINGS ]
                  Groq ✓  Gemini ✓

             status: IDLE · say "hey jarvis"
                   [  START AI  ]
```

- Orb centered vertically in the stage, diameter about 40% of stage height, four circuit nodes on a
  compass around it at about 1.45× the orb radius, connected by animated SVG lines. The whole
  composition scales with the stage; **no dead gaps**.
- Each node is a Panel with icon, title, and one live line: Memory "N facts"; Skills "N tools";
  Soul current style summary; Settings provider health.
- Clicking a node opens a SlideOver over the stage (Esc closes, focus trapped). It does not
  navigate away from Core.
- Below the orb: state text and the Start AI button (see 5.1).

### 4.3 Chat panel

- Header: "ASHIR" + state text, a clear-chat icon (with confirm), a speaker toggle (labeled by
  tooltip).
- Empty state: title, **one honest privacy line**, and 5 suggestion chips. Clicking a chip fills
  the input and does NOT auto-send.
- Messages: user right-aligned, assistant left-aligned. Under each assistant message a small
  caption "via Groq · 1.2s".
- Renderer: paragraphs, lists, bold, italic, inline code, fenced code blocks with a Copy button,
  links. Built as React elements with **no `dangerouslySetInnerHTML`**. Links open in the external
  browser only if `https`.
- Tool events: compact card with icon, tool name, status chip (queued, awaiting approval, running,
  done, failed), expandable details with paths shortened.
- Approvals inline: a card shows exactly what will change (counts and the first 10 items), buttons
  Approve and Deny, Enter = Approve only if the card is focused, Esc = Deny. Destructive-class
  actions still use a blocking modal.
- Composer: auto-grows to 6 lines, Enter sends, Shift+Enter newline, character counter shown near
  the 8000 cap, Stop button while streaming, Regenerate on the last answer, "Scroll to latest" pill
  when scrolled up.

### 4.4 Agent Town

Two-pane layout: the town canvas (24×14 tiles, desks A–D, whiteboard, server, coffee) and a Tasks
side panel with per-agent status (Alice Files, Bob System, Carol Routines, Dave Research — Dave
"Not connected"), the queue count, a Cancel button, and the "press E to talk to nearest" hint.

### 4.5 World Monitor

Two tabs: GLOBE and MAP. Header shows a live UTC clock. Left column: world clocks. Right column:
headlines feed (only if the user enabled it; otherwise an honest "Feed off" card with an Enable
button). Never hardcode fake hotspots or headlines.

### 4.6 Settings (slide-over or full view)

Sections: General, Voice, Providers, Privacy, Appearance, Updates, About.

- Providers: key fields show only `•••• last4` once saved, a "Test connection" button that runs in
  the main process and never echoes the key, and a model picker.
- Privacy: Private mode, Cloud transcription, "Show what is stored", "Delete all my data".
- Appearance: three theme cards each with a small color swatch strip, Reduce motion, Orb density
  (Low / Medium / High).
- Skills panel: each tool row has name, description, risk badge (READ / CHANGES FILES / SYSTEM) and
  an Enabled toggle. Disabled tools are removed from what the model sees AND blocked in the main
  process.
- First-run onboarding (4 steps): your name, provider keys, privacy explanation in plain words,
  microphone permission.

---

## 5. Behavior specs

### 5.1 AI power states and the orb

States: **OFF, STARTING, IDLE, LISTENING, THINKING, SPEAKING, ERROR, MIC-DENIED.** Implement as a
pure reducer with a transition table and unit tests.

| State     | Orb                                                     | Text                                                     |
| --------- | ------------------------------------------------------- | -------------------------------------------------------- |
| OFF       | dim (20% brightness), still                             | "AI is off"                                              |
| STARTING  | 1.2s boot: ring expands, particles fade in              | "Starting…"                                              |
| IDLE      | slow drift                                              | "Online · say the wake phrase" (only if wake word is on) |
| LISTENING | particles react to smoothed mic level (0–1)             | "Listening…"                                             |
| THINKING  | rotation speeds up, particles pull toward center        | "Thinking…"                                              |
| SPEAKING  | soft pulse on each spoken word (speech boundary events) | "Speaking…"                                              |
| ERROR     | accent → danger color, short message                    | e.g. "Groq unreachable, trying Gemini"                   |

- "Start AI" is the master switch: ON enables the chat link and, if the user turned it on, wake
  word and spoken replies. It never opens the microphone by itself unless hands-free or wake word
  is enabled in Settings. The top-bar power switch and Start AI stay in sync.
- Orb rendering: canvas, DPR-aware, particle count from the density setting (adaptive: reduce
  automatically if the frame time exceeds 20ms), cap 60fps, pause when the window is hidden or
  minimized. Mic level comes from the shared AudioHub, never from a second `getUserMedia` call.

### 5.2 Agent Town behavior

- Grid world 24×14 tiles, 16px source tiles drawn at integer scale (2× or 3×) with
  `image-rendering: pixelated`.
- Player "Manager": WASD or arrows, grid collision. Press E within 1.5 tiles of an agent to open an
  Assign dialog (one text field, Enter submits, Esc cancels). Keys only act when the Town view is
  focused.
- Agents: Alice = files tools, Bob = system tools, Carol = routine tools, Dave = research (greyed
  "Not connected" until a research tool exists).
- Agent state machine: idle → walking (BFS path) → working → needs-approval → done / failed → idle.
- Task lifecycle: queued → running → done or failed. One task per agent at a time, the rest queue
  (max 5). Tasks panel lists them with a Cancel button.
- Assignment goes through the SAME pipeline as chat: sent to the chat handler with an `agentId` that
  restricts the tool list to that agent's tools. **The main process enforces the tool filter, not
  only the UI.** Approvals, sandbox, redaction, Private mode and logging behave exactly as in normal
  chat. No shortcut around the approval gate.
- Each agent has its own system prompt, allowed-tools list, and short encrypted conversation memory.
- Banter lines are canned local text — do not spend API calls for small talk.
- Art is original; rendering capped at 30fps, paused when hidden. No game-engine dependency; a
  custom canvas engine is enough.

### 5.3 World Monitor behavior

- Globe: 2D canvas orthographic projection, slow auto-rotate, drag to rotate, wheel to zoom
  (clamped), night-side shading from the sun's position, graticule lines. All map data bundled
  locally — zero network calls to tile servers or CDNs.
- Map: same data in an equirectangular projection with pan and zoom, live UTC clock.
- Hotspots shown ONLY from real data. With the headline feed off there are none, and the panel says
  so. With the feed on: user-editable https RSS allowlist, no cookies, 10s timeout, 1MB cap,
  entity-expansion-safe parser, plain-text rendering; hotspots come from matching country names in
  headlines against a local gazetteer file.
- Headlines open in the external browser only after an https check.

### 5.4 System view

Real gauges for CPU, RAM, disk, battery, uptime, with a 60-sample sparkline each. Poll every 2s
only while the System view is visible. Show "n/a" where a reading doesn't exist, never a fake
number.

---

## 6. Deliberately NOT in scope before v2.0

Screen reading ("What's on my screen right now?"), sending WhatsApp messages, and controlling the
mouse or windows. High risk for a privacy-first product. If added later: per-action approval, a
visible "screen is being shared" indicator, and Private mode blocking them completely.
