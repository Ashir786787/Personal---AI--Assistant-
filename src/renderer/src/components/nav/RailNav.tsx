export type ViewId = 'core' | 'agents' | 'world' | 'system'

interface RailNavProps {
  view: ViewId
  onChange: (view: ViewId) => void
}

const ITEMS: Array<{ id: ViewId; glyph: string; label: string; tooltip: string }> = [
  { id: 'core', glyph: '◉', label: 'Core', tooltip: 'Core' },
  { id: 'agents', glyph: '⌗', label: 'Town', tooltip: 'Agent Town' },
  { id: 'world', glyph: '◍', label: 'World', tooltip: 'World Monitor' },
  { id: 'system', glyph: '▤', label: 'System', tooltip: 'System' }
]

export function RailNav({ view, onChange }: RailNavProps): JSX.Element {
  return (
    <nav className="rail" aria-label="Views">
      <div className="flex flex-col gap-1">
        {ITEMS.map((item) => (
          <button
            key={item.id}
            className={`rail-btn ${view === item.id ? 'rail-btn-active' : ''}`}
            title={item.tooltip}
            aria-label={item.tooltip}
            aria-current={view === item.id ? 'page' : undefined}
            onClick={() => onChange(item.id)}
          >
            <span className="rail-glyph">{item.glyph}</span>
            <span className="rail-label">{item.label}</span>
          </button>
        ))}
      </div>
      <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-muted opacity-50">
        ASHIR
      </div>
    </nav>
  )
}
