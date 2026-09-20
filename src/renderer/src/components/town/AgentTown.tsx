import { useEffect, useMemo, useRef, useState } from 'react'
import { TOWN_AGENTS } from '@shared/agents'
import { THEME_ACCENT, type ThemeId } from '../../theme'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useAgentTown } from '../../hooks/useAgentTown'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { TownCanvas } from './TownCanvas'
import { TasksPanel } from './TasksPanel'

interface AgentTownProps {
  theme: ThemeId
  focused: boolean
  approvalOpen: boolean
}

function accentTriplet(theme: ThemeId): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--c-accent').trim()
  if (value.startsWith('#')) {
    const hex = value.replace('#', '')
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ')
  }
  return value || THEME_ACCENT[theme].replace('#', '').match(/.{2}/g)!.join(' ')
}

export function AgentTown({ theme, focused, approvalOpen }: AgentTownProps): JSX.Element {
  const { reduced } = useReducedMotion()
  const town = useAgentTown({ focused, reduced, approvalOpen })
  const { dialog, closeDialog, submitDialog } = town
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const accent = useMemo(() => accentTriplet(theme), [theme])

  const dialogAgent = dialog ? (TOWN_AGENTS.find((a) => a.id === dialog.agentId) ?? null) : null
  const dialogDisabled = !dialogAgent?.connected || dialog?.error !== null

  useEffect(() => {
    if (dialog && !dialogDisabled) inputRef.current?.focus()
  }, [dialog, dialogDisabled])

  const handleSubmit = (): void => {
    if (dialogDisabled) return
    if (submitDialog(draft)) setDraft('')
  }

  return (
    <div className="flex h-full min-h-0">
      <main className="relative min-h-0 min-w-0 flex-1 p-3">
        <div className="glass-deep h-full overflow-hidden rounded-xl">
          <TownCanvas
            player={town.player}
            agents={town.agents.map((a) => ({
              id: a.id,
              title: a.title.replace(/ .*/, ''),
              connected: a.connected,
              pos: a.pos,
              pose: a.pose
            }))}
            accentTriplet={accent}
            reduced={reduced}
          />
        </div>
        <div className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 font-mono text-[11px] uppercase tracking-[0.3em] text-ink-muted opacity-70">
          Press [E] beside an agent to talk
        </div>
      </main>
      <TasksPanel
        agents={town.agents.map((a) => ({ id: a.id, pose: a.pose, connected: a.connected }))}
        tasks={town.tasks}
        queueCount={town.queueCount}
        onCancel={town.cancelTask}
      />

      <Modal
        open={dialog !== null && dialogAgent !== null}
        onClose={closeDialog}
        title={dialogAgent ? `Ask ${dialogAgent.name} — ${dialogAgent.domain}` : 'Ask agent'}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={closeDialog}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSubmit} disabled={dialogDisabled}>
              Assign
            </Button>
          </>
        }
      >
        {!dialogAgent?.connected && dialogAgent ? (
          <p className="text-sm text-ink-muted">
            {dialogAgent.title} has no tool yet — not connected. The task can't start.
          </p>
        ) : (
          <p className="mb-3 text-xs text-ink-muted">
            {dialog?.error ??
              `Give ${dialogAgent?.title.toLowerCase()} one instruction. It goes through the same secure pipeline as chat — any action still needs your approval.`}
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
        >
          <input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="e.g. tidy Downloads into folders"
            disabled={dialogDisabled}
            autoFocus={!dialogDisabled}
            aria-label="Task for agent"
            className="w-full rounded-lg border border-edge bg-base px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60 focus:outline-accent"
          />
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted/70">
            enter submits · esc cancels
          </p>
        </form>
      </Modal>
    </div>
  )
}
