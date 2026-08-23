interface CircuitCardsProps {
  onOpen: (circuit: 'memory' | 'skills' | 'soul' | 'settings') => void
}

const CIRCUITS: Array<{
  id: 'memory' | 'skills' | 'soul' | 'settings'
  glyph: string
  title: string
  sub: string
}> = [
  { id: 'memory', glyph: '❖', title: 'Memory', sub: 'What it knows about you' },
  { id: 'skills', glyph: '⚡', title: 'Skills', sub: 'Real actions it can take' },
  { id: 'soul', glyph: '✷', title: 'Soul', sub: 'Personality tuning' },
  { id: 'settings', glyph: '⚙', title: 'Settings', sub: 'Keys, theme, updates' }
]

export function CircuitCards({ onOpen }: CircuitCardsProps): JSX.Element {
  return (
    <div className="grid w-full max-w-xl grid-cols-4 gap-3">
      {CIRCUITS.map((circuit) => (
        <button key={circuit.id} className="circuit-card" onClick={() => onOpen(circuit.id)}>
          <span className="circuit-glyph">{circuit.glyph}</span>
          <span className="circuit-title">{circuit.title}</span>
          <span className="circuit-sub">{circuit.sub}</span>
        </button>
      ))}
    </div>
  )
}
