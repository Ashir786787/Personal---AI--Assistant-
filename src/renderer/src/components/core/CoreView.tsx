import { useCallback, useEffect, useRef, useState } from 'react'
import type { MemorySummary, ProviderKeyStatus, SkillEntry } from '@shared/ipc'
import { SlideOver } from '../ui/SlideOver'
import { VoiceOrb, type OrbState } from '../orb/VoiceOrb'
import { MemoryPanel } from '../circuits/MemoryPanel'
import { SkillsPanel } from '../circuits/SkillsPanel'
import { SoulPanel } from '../circuits/SoulPanel'
import { readSoulSummary } from '../circuits/soulTraits'
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

const CIRCUITS: Array<{ id: CircuitId; glyph: string; title: string }> = [
  { id: 'memory', glyph: '❖', title: 'Memory' },
  { id: 'skills', glyph: '⚡', title: 'Skills' },
  { id: 'soul', glyph: '✷', title: 'Soul' }
]

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
  const [orbD, setOrbD] = useState(220)
  const [open, setOpen] = useState<CircuitId | null>(null)
  const [summary, setSummary] = useState<MemorySummary | null>(null)
  const [skills, setSkills] = useState<SkillEntry[] | null>(null)
  const [keys, setKeys] = useState<ProviderKeyStatus>({ gemini: false, groq: false })

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = (): void => {
      const rect = el.getBoundingClientRect()
      setOrbD((prev) => {
        const next = Math.round(
          Math.min(360, Math.max(160, Math.min(rect.width, rect.height) - 60))
        )
        return Math.abs(prev - next) > 8 ? next : prev
      })
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

  return (
    <div className="relative flex h-full flex-col">
      <div ref={stageRef} className="relative flex min-h-0 flex-1 items-center justify-center">
        <button
          type="button"
          aria-label="Toggle AI power"
          onClick={power.status === 'off' ? onStart : onToggleMic}
          className="shrink-0"
        >
          <VoiceOrb
            state={orbState}
            level={level}
            size={orbD}
            powerOn={power.status !== 'off' && power.status !== 'error'}
            onToggle={power.status === 'off' ? onStart : onToggleMic}
          />
        </button>
      </div>

      <div className="relative shrink-0 px-6 pb-2 text-center">
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

      <div className="grid shrink-0 grid-cols-4 gap-2 px-6 pb-5 pt-3">
        {[...CIRCUITS, { id: 'settings' as const, glyph: '⚙', title: 'Settings' }].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => showNode(item.id)}
            className={`core-node ${open === item.id ? 'core-node-active' : ''}`}
          >
            <span className="core-node-glyph">{item.glyph}</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink">
              {item.title}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-widest text-ink-muted">
              {liveLine[item.id]}
            </span>
          </button>
        ))}
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
