import { useEffect, useState } from 'react'
import type { SkillEntry } from '@shared/ipc'

interface Props {
  onClose: () => void
}

export function SkillsPanel({ onClose }: Props): JSX.Element {
  const [skills, setSkills] = useState<SkillEntry[] | null>(null)

  useEffect(() => {
    void window.ashirs.listSkills().then(setSkills)
  }, [])

  return (
    <div className="confirm-backdrop" onClick={onClose}>
      <div
        className="confirm-card"
        role="dialog"
        aria-modal="true"
        aria-label="Skills circuit"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-header">
          <span className="circuit-glyph-lg text-accent">⚡</span>
          <h2>Skills Circuit</h2>
          <p className="confirm-sub">
            Every action your assistant can really take. Anything that changes your system always
            asks for approval first.
          </p>
        </div>

        <div className="settings-body skills-body">
          {skills === null && <p className="update-line">Loading skill registry…</p>}
          {skills?.length === 0 && (
            <p className="update-line">No skills registered — this should never happen</p>
          )}
          {skills?.map((skill) => (
            <div key={skill.name} className="skill-card">
              <span className="font-mono text-xs text-accent">{skill.name}</span>
              <p className="text-xs leading-relaxed text-ink-muted">{skill.description}</p>
            </div>
          ))}
        </div>

        <div className="confirm-actions">
          <button className="btn-cancel" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
