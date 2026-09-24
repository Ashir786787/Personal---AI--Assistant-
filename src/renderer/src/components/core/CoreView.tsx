import { useCallback, useEffect, useRef, useState } from 'react'
import type { MemorySummary, ProviderKeyStatus, SkillEntry } from '@shared/ipc'
import { SlideOver } from '../ui/SlideOver'
import { VoiceOrb, type OrbState } from '../orb/VoiceOrb'
import { MemoryPanel } from '../circuits/MemoryPanel'
import { SkillsPanel } from '../circuits/SkillsPanel'
import { SoulPanel } from '../circuits/SoulPanel'
import { readSoulSummary } from '../circuits/soulTraits'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { powerLine, type PowerState } from '../../state/powerState'

type CircuitId = 'memory' | 'skills' | 'soul'

interface CoreViewProps {
  power: PowerState
  wakeOn: boolean
  level: number
  onStart: () => void
  onStop: () => void
  onToggleMic: () => void
  onOpenSettings: () => void
}

const NODE_W = 150
const NODE_H = 96

const CIRCUITS: Array<{ id: CircuitId; glyph: string; title: string }> = [
  { id: 'memory', glyph: '❖', title: 'Memory' },
  { id: 'skills', glyph: '⚡', title: 'Skills' },
  { id: 'soul', glyph: '✷', title: 'Soul' }
]

function orbDiameter(w: number, h: number): number {
  const minByWidth = (w / 2 - NODE_W / 2) / 0.725
  const minByHeight = (h / 2 - NODE_H / 2) / 0.725
  return Math.max(150, Math.min(h * 0.4, minByWidth, minByHeight))
}

export function CoreView({
  power,
  wakeOn,
  level,
  onStart,
  onStop,
  onToggleMic,
  onOpenSettings
}: CoreViewProps): JSX.Element {
  const stageRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 560, h: 600 })
  const [open, setOpen] = useState<CircuitId | null>(null)
  const [summary, setSummary] = useState<MemorySummary | null>(null)
  const [skills, setSkills] = useState<SkillEntry[] | null>(null)
  const [keys, setKeys] = useState<ProviderKeyStatus>({ gemini: false, groq: false })
  const { reduced } = useReducedMotion()

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = (): void => {
      const rect = el.getBoundingClientRect()
      setBox((prev) =>
        prev.w === rect.width && prev.h === rect.height
          ? prev
          : { w: Math.max(rect.width, 320), h: Math.max(rect.height, 360) }
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const refreshLines = useCallback((): void => {
    void window.ashirs.memorySummary().then(setSummary)
    void window.ashirs.listSkills().then(setSkills)
    void window.ashirs.getKeyStatus().then(setKeys)
  }, [])

  useEffect(refreshLines, [refreshLines])

  const cx = box.w / 2
  const cy = box.h / 2
  const orbD = orbDiameter(box.w, box.h)
  const orbitR = Math.max(
    10,
    Math.min(orbD * 0.725, cx - NODE_W / 2 - 14, cy - NODE_H / 2 - 8, box.h - cy - NODE_H / 2 - 20)
  )

  const points: Record<'memory' | 'skills' | 'soul' | 'settings', { x: number; y: number }> = {
    memory: { x: cx, y: cy - orbitR },
    skills: { x: cx - orbitR, y: cy },
    soul: { x: cx + orbitR, y: cy },
    settings: { x: cx, y: cy + orbitR }
  }

  const orbState: OrbState =
    power.status === 'off' ? 'off' : power.status === 'listening' ? 'listening' : 'thinking'
  const line = powerLine(power, { wakeOn })

  const liveLine: Record<CircuitId | 'settings', string> = {
    memory: summary ? `${summary.messageCount} messages` : 'Loading…',
    skills: skills ? `${skills.length} tools` : 'Loading…',
    soul: readSoulSummary(),
    settings:
      keys.groq && keys.gemini
        ? 'Groq · Gemini'
        : keys.groq || keys.gemini
          ? keys.groq
            ? 'Groq on'
            : 'Gemini on'
          : 'No keys yet'
  }

  const showNode = (id: CircuitId | 'settings'): void => {
    if (id === 'settings') {
      onOpenSettings()
      return
    }
    setOpen(id)
  }

  const connectorStyle = reduced ? { strokeDasharray: 'none' as const } : undefined

  return (
    <div className="relative flex h-full flex-col">
      <div ref={stageRef} className="relative min-h-0 flex-1">
        <svg
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
          style={{ overflow: 'visible' }}
        >
          {(Object.keys(points) as Array<'memory' | 'skills' | 'soul' | 'settings'>).map((key) => (
            <line
              key={key}
              x1={cx}
              y1={cy}
              x2={points[key].x}
              y2={points[key].y}
              stroke="currentColor"
              strokeOpacity="0.14"
              className="text-accent"
              strokeDasharray="2 10"
              style={connectorStyle}
            >
              {!reduced && (
                <animate
                  attributeName="stroke-dashoffset"
                  from="24"
                  to="0"
                  dur="1.6s"
                  repeatCount="indefinite"
                />
              )}
            </line>
          ))}
        </svg>

        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ width: orbD, height: orbD }}
        >
          <VoiceOrb
            state={orbState}
            level={level}
            size={orbD}
            powerOn={power.status !== 'off' && power.status !== 'error'}
            onToggle={power.status === 'off' ? onStart : onToggleMic}
          />
        </div>

        {(Object.keys(points) as Array<'memory' | 'skills' | 'soul' | 'settings'>).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => showNode(key)}
            className={`core-node ${open === key ? 'core-node-active' : ''}`}
            style={{
              left: points[key].x,
              top: points[key].y,
              width: NODE_W
            }}
          >
            <span className="core-node-glyph">
              {key === 'settings' ? '⚙' : CIRCUITS.find((c) => c.id === key)?.glyph}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink">
              {key === 'settings' ? 'Settings' : CIRCUITS.find((c) => c.id === key)?.title}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-widest text-ink-muted">
              {liveLine[key]}
            </span>
          </button>
        ))}
      </div>

      <div className="relative pb-2 text-center">
        <p
          className={`font-mono text-[11px] uppercase tracking-[0.4em] ${
            power.status === 'error' || power.status === 'mic-denied'
              ? 'text-warning'
              : power.status === 'listening' || power.status === 'thinking'
                ? 'text-accent'
                : 'text-ink-muted'
          }`}
        >
          {line}
        </p>
        <button
          type="button"
          onClick={power.status === 'off' ? onStart : onStop}
          className={`mt-3 rounded-full border px-6 py-2 font-mono text-[11px] uppercase tracking-[0.3em] transition-colors duration-fast ${
            power.status === 'off'
              ? 'border-accent-dim text-accent hover:bg-accent hover:text-base'
              : 'border-edge text-ink-muted hover:bg-panel-raised'
          }`}
        >
          {power.status === 'off' ? 'Start AI' : 'AI On · tap to stop'}
        </button>
      </div>

      <SlideOver open={open === 'memory'} onClose={() => setOpen(null)} title="Memory Circuit">
        <MemoryPanel onClose={() => setOpen(null)} />
      </SlideOver>
      <SlideOver open={open === 'skills'} onClose={() => setOpen(null)} title="Skills Circuit">
        <SkillsPanel onClose={() => setOpen(null)} />
      </SlideOver>
      <SlideOver open={open === 'soul'} onClose={() => setOpen(null)} title="Soul Circuit">
        <SoulPanel onClose={() => setOpen(null)} />
      </SlideOver>
    </div>
  )
}
