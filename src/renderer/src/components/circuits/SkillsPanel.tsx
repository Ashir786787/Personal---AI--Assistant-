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
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-ink-muted">
        Every action your assistant can really take. Anything that changes your system always asks
        for approval first.
      </p>

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

      <div className="flex justify-end pt-2">
        <button className="btn-cancel" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
