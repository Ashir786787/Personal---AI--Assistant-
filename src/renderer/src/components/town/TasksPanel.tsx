import type { AgentId } from '@shared/agents'
import { TOWN_AGENTS } from '@shared/agents'
import type { TownTask } from '../../state/townTasks'
import type { AgentPose } from '../../state/townTasks'

const POSE_LABEL: Record<AgentPose, string> = {
  idle: 'Idle',
  walking: 'Moving',
  working: 'Working',
  'needs-approval': 'Needs approval',
  done: 'Done',
  failed: 'Failed',
  cancelled: 'Cancelled'
}

const POSE_STYLE: Record<AgentPose, string> = {
  idle: 'text-ink-muted',
  walking: 'text-accent',
  working: 'text-accent',
  'needs-approval': 'text-warning',
  done: 'text-ok',
  failed: 'text-danger',
  cancelled: 'text-ink-muted'
}

interface TasksPanelProps {
  agents: {
    id: AgentId
    pose: AgentPose
    connected: boolean
  }[]
  tasks: TownTask[]
  queueCount: number
  onCancel: (id: string) => void
}

function cancelLabel(status: TownTask['status']): string {
  return status === 'running' ? 'Cancel' : 'Remove'
}

export function TasksPanel({ agents, tasks, queueCount, onCancel }: TasksPanelProps) {
  const byAgent = agents.map((agent) => ({
    meta: TOWN_AGENTS.find((a) => a.id === agent.id),
    pose: agent.pose,
    connected: agent.connected,
    tasks: tasks.filter((t) => t.agentId === agent.id)
  }))

  return (
    <aside className="flex h-full w-[320px] shrink-0 flex-col border-l border-edge bg-base/40">
      <div className="flex items-center justify-between border-b border-edge px-4 py-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink-muted">Tasks</h2>
        <span className="rounded-full border border-edge px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
          {queueCount} / 5
        </span>
      </div>

      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {byAgent.map(({ meta, pose, connected, tasks: agentTasks }) => {
          if (!meta) return null
          return (
            <li key={meta.id} className="rounded-xl border border-edge bg-panel/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${pose === 'idle' ? 'bg-ink-muted/40' : 'bg-accent animate-pulse'}`}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-semibold text-ink">{meta.name}</span>
                </div>
                <span
                  className={`rounded-full border border-edge px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${
                    connected ? 'text-ink-muted' : 'text-ink-muted/60'
                  }`}
                >
                  {meta.domain}
                </span>
              </div>

              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-ink-muted">{meta.title}</span>
                {!connected ? (
                  <span className="rounded-full border border-ink-muted/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-ink-muted/60">
                    Not connected
                  </span>
                ) : (
                  <span
                    className={`font-mono text-[11px] uppercase tracking-widest ${POSE_STYLE[pose]}`}
                  >
                    {POSE_LABEL[pose]}
                  </span>
                )}
              </div>

              {!connected && (
                <p className="mt-2 text-xs text-ink-muted/70">
                  {meta.title} has no tools connected yet — tasks to it stay disabled.
                </p>
              )}
              {connected && agentTasks.length === 0 && (
                <p className="mt-2 text-xs italic text-ink-muted/70">“{meta.motto}”</p>
              )}

              {agentTasks.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {agentTasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-edge/70 bg-base/60 px-2 py-1.5"
                    >
                      <div className="min-w-0 text-left">
                        <p className="truncate text-xs text-ink">{task.text}</p>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">
                          {task.status}
                        </p>
                      </div>
                      {(task.status === 'queued' || task.status === 'running') && (
                        <button
                          type="button"
                          onClick={() => onCancel(task.id)}
                          className="shrink-0 rounded-full border border-edge px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-ink-muted hover:border-danger hover:text-danger"
                        >
                          {cancelLabel(task.status)}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>

      <div className="border-t border-edge px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted/70">
          WASD move · E talk · ENTER submit · ESC cancel
        </p>
      </div>
    </aside>
  )
}
