# UI-INVENTORY.md — status of the pre-UI-0 hardcode audit

Reference for the token migration in `docs/UI-SPEC.md` section 3. The tables below
were extracted from the codebase **before** the redesign and are kept as the
before-picture. Status as of v1.5.14:

- Every hardcoded hex listed under "Hardcoded hex colors" has been replaced by a
  token (`--c-*`, mapped from the spec tone keys). The only value that ever lagged
  was `.btn-approve`'s text color, which now reads `rgb(var(--c-base))` instead of
  a raw `#17130a`.
- Every "Hardcoded font sizes" entry was replaced. No `text-[9px]` or
  `text-[10px]` remains in `src/renderer/src/**/*.tsx`, and no
  `font-size` below `11px` remains in `global.css`. Mono captions and labels
  across chat, approvals, town, world, headlines, clocks and system views all
  use `text-[11px]` per the spec's 11px caps rule.
- The "Neutral surfaces to convert" note is done: glass and hover overlays derive
  from the panel tones.

**Line numbers below refer to the pre-migration files and are kept only as
history. Do not use them to locate current code** — read `global.css` and
`src/renderer/src/components/ui/` for the current state.

## Hardcoded hex colors (no token)

### `src/renderer/src/styles/global.css`

| Location (line) | Value     | Used for                         | Intended token   |
| --------------- | --------- | -------------------------------- | ---------------- |
| 134             | `#f59e0b` | `.update-pill` border            | `--warn`         |
| 135             | `#fbbf24` | `.update-pill` color             | `--warn`         |
| 160             | `#26262b` | `.update-bar` background         | neutral surface  |
| 166             | `#4ce0d2` | `.update-bar-fill`               | `--accent`       |
| 171             | `#d6d3d1` | `.update-line`                   | `--text-2`       |
| 342             | `#f59e0b` | `.confirm-card` border           | `--warn`         |
| 344             | `#17181c` | `.confirm-card` background       | `--bg-2`         |
| 353             | `#f59e0b` | `.confirm-shield`                | `--warn`         |
| 359             | `#f5f5f4` | `.confirm-header h2`             | `--text-1`       |
| 365             | `#a8a29e` | `.confirm-sub`                   | `--text-3`       |
| 374             | `#101114` | `.confirm-list` background       | `--bg-0`         |
| 378             | `#d6d3d1` | `.confirm-list` text             | `--text-2`       |
| 391             | `#f59e0b` | `.btn-approve` background        | `--warn`         |
| 392             | `#17130a` | `.btn-approve` color             | text on `--warn` |
| 397             | `#fbbf24` | `.btn-approve:hover`             | `--warn` lighten |
| 402             | `#3f3f46` | `.btn-cancel` border             | `--line`         |
| 403             | `#d4d4d8` | `.btn-cancel` color              | `--text-2`       |
| 407             | `#26262b` | `.btn-cancel:hover` background   | neutral surface  |
| 427             | `#14532d` | `.toast-ok` background           | `--ok` dark      |
| 428             | `#dcfce7` | `.toast-ok` color                | on `--ok` text   |
| 429             | `#16a34a` | `.toast-ok` border               | `--ok`           |
| 432             | `#27272a` | `.toast-cancel` background       | neutral surface  |
| 433             | `#d4d4d8` | `.toast-cancel` color            | `--text-2`       |
| 434             | `#52525b` | `.toast-cancel` border           | `--line`         |
| 449             | `#a1a1aa` | `.gear-btn` color                | `--text-3`       |
| 454             | `#f5f5f4` | `.gear-btn:hover`                | `--text-1`       |
| 455             | `#26262b` | `.gear-btn:hover` background     | neutral surface  |
| 470             | `#101114` | `.settings-body` background      | `--bg-0`         |
| 487             | `#e7e5e4` | `.settings-provider strong`      | `--text-1`       |
| 491             | `#78716c` | `.settings-provider span`        | `--text-3`       |
| 497             | `#3f3f46` | `.settings-row input` border     | `--line`         |
| 498             | `#17181c` | `.settings-row input` background | `--bg-2`         |
| 499             | `#e7e5e4` | `.settings-row input` color      | `--text-1`       |
| 504             | `#f59e0b` | `.settings-row input:focus`      | `--accent`       |
| 512             | `#34d399` | `.settings-ok`                   | `--ok`           |
| 516             | `#f87171` | `.settings-err`                  | `--danger`       |

### `src/renderer/src/theme.ts`

| Line | Value                | Used for            |
| ---- | -------------------- | ------------------- |
| 12   | `ion: '#4CE0D2'`     | legacy accent token |
| 13   | `crimson: '#F87171'` | legacy accent token |
| 14   | `emerald: '#34D399'` | legacy accent token |

## Font sizes below the 11px floor (spec 3.2)

### CSS (`global.css`)

| Selme (line)            | Size  | Replacement                  |
| ----------------------- | ----- | ---------------------------- |
| `.theme-pill` (114)     | 10px  | 11px caps + tracking `.14em` |
| `.update-pill` (136)    | 10px  | 11px                         |
| `.chip` (148)           | 10px  | 11px                         |
| `.rail-btn` label (219) | 7.5px | 11px caps (spec 4.1)         |
| `.circuit-sub` (255)    | 9px   | 11px                         |
| `.circuit-glyph` (243)  | 16px  | icon primitive               |

### Components (tailwind arbitrary values)

`text-[9px]` / `text-[10px]`:

- `App.tsx:164` — 10px caption
- `WorldMonitor.tsx:49` (9px), `:59` (10px)
- `MemoryPanel.tsx:55` (10px)
- `SoulPanel.tsx:79,93` (10px)
- `MessageList.tsx:15` (10px empty-state caps)
- `MessageBubble.tsx:39` (10px)
- `SystemView.tsx:36` (10px)
- `AgentTown.tsx:207` (9px)
- `RailNav.tsx:33` (9px)
- `StatusBar.tsx:47` (10px)

All of the above become 11px caps (tracking `.14em` for labels).

## Neutral surfaces to convert

`background-color: rgb(255 255 255 / 0.03)` (glass), `rgb(255 255 255 / 0.04)` (hovers) track to a
`--surface-overlay` convention derived from `--bg-1` at 80% opacity (spec 3.3).

## Not hardcoded (already tokenized)

- Tailwind utility colors (`base`, `panel`, `edge`, `accent`, `ink`, `ink-muted`) — map to CSS
  vars in `tailwind.config.cjs`.
- `AgentTown` inline `rgb(...)` strings are derived from the live CSS vars at render time.
