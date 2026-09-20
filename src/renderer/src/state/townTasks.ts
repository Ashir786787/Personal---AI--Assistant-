import { AGENT_IDS, type AgentId } from '@shared/agents'

export const TASK_QUEUE_MAX = 5

export type TaskStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled'

export interface TownTask {
  id: string
  agentId: AgentId
  text: string
  status: TaskStatus
  createdAt: number
  finishedAt?: number
  note?: string
}

export interface TownTaskState {
  tasks: TownTask[]
}

export type TownTaskAction =
  | { type: 'QUEUE_TASK'; agentId: AgentId; text: string }
  | { type: 'START_TASK'; id: string }
  | { type: 'TASK_DONE'; id: string }
  | { type: 'TASK_FAILED'; id: string; note: string }
  | { type: 'TASK_CANCELLED'; id: string }
  | { type: 'CANCEL_QUEUED'; id: string }

export const INITIAL_TOWN_TASKS: TownTaskState = { tasks: [] }

let nextTaskId = 1

export function townTaskReducer(state: TownTaskState, action: TownTaskAction): TownTaskState {
  switch (action.type) {
    case 'QUEUE_TASK': {
      if (agentBusy(state, action.agentId)) return state
      if (queueCount(state) >= TASK_QUEUE_MAX) return state
      const task: TownTask = {
        id: `task-${nextTaskId++}`,
        agentId: action.agentId,
        text: action.text,
        status: 'queued',
        createdAt: Date.now()
      }
      return { tasks: [...state.tasks, task] }
    }
    case 'START_TASK': {
      const running = state.tasks.some((t) => t.status === 'running')
      if (running) return state
      return {
        tasks: state.tasks.map((t) => (t.id === action.id ? { ...t, status: 'running' } : t))
      }
    }
    case 'TASK_DONE': {
      return {
        tasks: state.tasks.map((t) =>
          t.id === action.id ? { ...t, status: 'done', finishedAt: Date.now() } : t
        )
      }
    }
    case 'TASK_FAILED': {
      return {
        tasks: state.tasks.map((t) =>
          t.id === action.id
            ? { ...t, status: 'failed', finishedAt: Date.now(), note: action.note }
            : t
        )
      }
    }
    case 'TASK_CANCELLED': {
      return {
        tasks: state.tasks.map((t) =>
          t.id === action.id ? { ...t, status: 'cancelled', finishedAt: Date.now() } : t
        )
      }
    }
    case 'CANCEL_QUEUED': {
      return { tasks: state.tasks.filter((t) => t.id !== action.id) }
    }
  }
}

/** A task is running or queued for this agent, so a new one must wait (spec: one per agent). */
export function agentBusy(state: TownTaskState, agentId: AgentId): boolean {
  return state.tasks.some(
    (t) => t.agentId === agentId && (t.status === 'queued' || t.status === 'running')
  )
}

export function queueCount(state: TownTaskState): number {
  return state.tasks.filter((t) => t.status === 'queued').length
}

export function runningTask(state: TownTaskState): TownTask | null {
  return state.tasks.find((t) => t.status === 'running') ?? null
}

export function nextQueued(state: TownTaskState): TownTask | null {
  if (runningTask(state)) return null
  return state.tasks.find((t) => t.status === 'queued') ?? null
}

export type AgentPose =
  'idle' | 'walking' | 'working' | 'needs-approval' | 'done' | 'failed' | 'cancelled'

export interface AgentPoseFlash {
  status: 'done' | 'failed' | 'cancelled'
  at: number
}

export const FLASH_MS = 2600

/** Per-agent pose derived from task state, movement and a short terminal flash. */
export function derivePose(
  state: TownTaskState,
  moving: readonly boolean[],
  flash: Record<string, AgentPoseFlash | null>,
  approvalOpen: boolean,
  now = Date.now()
): Record<string, AgentPose> {
  const poses: Record<string, AgentPose> = {}
  for (const agent of AGENT_IDS) {
    const task = state.tasks.find(
      (t) => t.agentId === agent && (t.status === 'running' || t.status === 'queued')
    )
    if (task && task.status === 'running') {
      poses[agent] = approvalOpen ? 'needs-approval' : 'working'
      continue
    }
    const recent = flash[agent]
    if (recent && now - recent.at < FLASH_MS) {
      poses[agent] = recent.status
      continue
    }
    const index = AGENT_IDS.indexOf(agent)
    poses[agent] = moving[index] ? 'walking' : 'idle'
  }
  return poses
}
