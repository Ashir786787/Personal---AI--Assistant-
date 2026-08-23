export type ViewId = 'core' | 'agents' | 'world' | 'system'

interface RailNavProps {
  view: ViewId
  onChange: (view: ViewId) => void
}

const ITEMS: Array<{ id: ViewId; glyph: string; label: string }> = [
  { id: 'core', glyph: '◉', label: 'Core' },
  { id: 'agents', glyph: '⌗', label: 'Agent Town' },
  { id: 'world', glyph: '◍', label: 'World Monitor' },
  { id: 'system', glyph: '▤', label: 'System' }
]

export function RailNav({ view, onChange }: RailNavProps): JSX.Element {
  return (
    <nav className="rail" aria-label="Views">
      <div className="flex flex-col gap-1">
        {ITEMS.map((item) => (
          <button
            key={item.id}
            className={`rail-btn ${view === item.id ? 'rail-btn-active' : ''}`}
            title={item.label}
            aria-label={item.label}
            aria-current={view === item.id ? 'page' : undefined}
            onClick={() => onChange(item.id)}
          >
            <span className="text-base leading-none">{item.glyph}</span>
            <span className="rail-label">{item.label}</span>
          </button>
        ))}
      </div>
      <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted opacity-50">
        ASHIR
      </div>
    </nav>
  )
}
