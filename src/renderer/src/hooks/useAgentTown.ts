import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { AGENT_IDS, TOWN_AGENTS, type AgentId } from '@shared/agents'
import {
  AGENT_SPOTS,
  COFFEE_SPOT,
  PLAYER_START,
  bfsPath,
  buildTownMap,
  movePlayer,
  nearestAgent,
  type Pt
} from '../state/townGrid'
import {
  INITIAL_TOWN_TASKS,
  agentBusy,
  derivePose,
  townTaskReducer,
  type AgentPose,
  type AgentPoseFlash,
  type TownTask
} from '../state/townTasks'

const STEP_MS = 150
const WANDER_CHANCE = 0.03

export interface AssignDialogState {
  agentId: AgentId
  error: string | null
}

export interface AgentTownController {
  player: Pt
  agents: {
    id: AgentId
    title: string
    domain: string
    connected: boolean
    pos: Pt
    pose: AgentPose
  }[]
  tasks: TownTask[]
  queueCount: number
  moves: boolean[]
  dialog: AssignDialogState | null
  openDialog: (agentId: AgentId) => void
  closeDialog: () => void
  submitDialog: (text: string) => boolean
  cancelTask: (id: string) => void
  canAssign: (agentId: AgentId) => boolean
}

const MOVE_KEYS: Record<string, { dx: number; dy: number }> = {
  w: { dx: 0, dy: -1 },
  W: { dx: 0, dy: -1 },
  ArrowUp: { dx: 0, dy: -1 },
  s: { dx: 0, dy: 1 },
  S: { dx: 0, dy: 1 },
  ArrowDown: { dx: 0, dy: 1 },
  a: { dx: -1, dy: 0 },
  A: { dx: -1, dy: 0 },
  ArrowLeft: { dx: -1, dy: 0 },
  d: { dx: 1, dy: 0 },
  D: { dx: 1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 }
}

const ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

function busied(tasks: TownTask[], agentId: AgentId): boolean {
  return tasks.some(
    (t) => t.agentId === agentId && (t.status === 'queued' || t.status === 'running')
  )
}

export function useAgentTown(opts: {
  focused: boolean
  reduced: boolean
  approvalOpen: boolean
}): AgentTownController {
  const { focused, reduced, approvalOpen } = opts
  const [taskState, dispatch] = useReducer(townTaskReducer, INITIAL_TOWN_TASKS)
  const [player, setPlayer] = useState<Pt>(PLAYER_START)
  const [agentsPos, setAgentsPos] = useState<Pt[]>(() => AGENT_SPOTS.map((p) => ({ ...p })))
  const [dialog, setDialog] = useState<AssignDialogState | null>(null)
  const [flash, setFlash] = useState<Record<string, AgentPoseFlash | null>>({})
  const [moves, setMoves] = useState<boolean[]>(() => AGENT_IDS.map(() => false))

  const map = useRef(buildTownMap())
  const playerRef = useRef(player)
  const agentsPosRef = useRef(agentsPos)
  const keys = useRef(new Set<string>())
  const paths = useRef<(Pt[] | null)[]>(AGENT_IDS.map(() => null))
  const standby = useRef<number[]>(AGENT_IDS.map(() => 0))
  const tasksRef = useRef(taskState)
  const runningTaskRef = useRef<string | null>(null)
  const reducedRef = useRef(reduced)
  reducedRef.current = reduced
  const focusedRef = useRef(focused)
  focusedRef.current = focused

  useEffect(() => {
    tasksRef.current = taskState
  }, [taskState])

  const advance = useCallback((): void => {
    const next = tasksRef.current.tasks.find(
      (t) => t.status === 'queued' && !runningTaskRef.current
    )
    if (!next) return
    dispatch({ type: 'START_TASK', id: next.id })
    runningTaskRef.current = next.id
    window.ashirs.sendChat({ text: next.text, agentId: next.agentId }).catch(() => {
      dispatch({ type: 'TASK_FAILED', id: next.id, note: 'The task never reached the core' })
      if (runningTaskRef.current === next.id) runningTaskRef.current = null
      window.setTimeout(advance, 500)
    })
  }, [dispatch])

  const finishTask = useCallback(
    (ev: { type: 'done' } | { type: 'error'; message: string } | { type: 'cancelled' }): void => {
      const id = runningTaskRef.current
      if (!id) return
      const task = tasksRef.current.tasks.find((t) => t.id === id)
      runningTaskRef.current = null
      if (!task) return
      if (ev.type === 'done') {
        dispatch({ type: 'TASK_DONE', id })
        setFlash((prev) => ({ ...prev, [task.agentId]: { status: 'done', at: Date.now() } }))
      } else if (ev.type === 'error') {
        dispatch({ type: 'TASK_FAILED', id, note: ev.message })
        setFlash((prev) => ({ ...prev, [task.agentId]: { status: 'failed', at: Date.now() } }))
      } else {
        dispatch({ type: 'TASK_CANCELLED', id })
        setFlash((prev) => ({ ...prev, [task.agentId]: { status: 'cancelled', at: Date.now() } }))
      }
      window.setTimeout(advance, 600)
    },
    [advance, dispatch]
  )

  useEffect(() => {
    if (typeof window.ashirs === 'undefined') return
    const unsubscribe = window.ashirs.onStreamEvent((event) => {
      if (event.type === 'done') finishTask({ type: 'done' })
      else if (event.type === 'error') finishTask({ type: 'error', message: event.message })
      else if (event.type === 'cancelled') finishTask({ type: 'cancelled' })
    })
    return unsubscribe
  }, [finishTask])

  useEffect(() => {
    const timers = AGENT_IDS.map((agent) =>
      window.setTimeout(() => {
        setFlash((prev) => ({ ...prev, [agent]: null }))
      }, 2800)
    )
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [])

  const openDialog = useCallback((agentId: AgentId): void => {
    const agent = TOWN_AGENTS.find((a) => a.id === agentId)
    if (!agent) return
    if (!agent.connected) {
      setDialog({ agentId, error: `${agent.title} has no tool yet — not connected.` })
      return
    }
    if (busied(tasksRef.current.tasks, agentId)) {
      setDialog({ agentId, error: `${agent.name} is already busy with a task.` })
      return
    }
    setDialog({ agentId, error: null })
  }, [])

  const closeDialog = useCallback((): void => setDialog(null), [])

  const submitDialog = useCallback(
    (text: string): boolean => {
      if (!dialog) return false
      const trimmed = text.trim()
      if (trimmed.length === 0) return false
      const agent = TOWN_AGENTS.find((a) => a.id === dialog.agentId)
      if (!agent || !agent.connected || busied(tasksRef.current.tasks, dialog.agentId)) {
        return false
      }
      dispatch({ type: 'QUEUE_TASK', agentId: dialog.agentId, text: trimmed })
      setDialog(null)
      window.setTimeout(advance, 50)
      return true
    },
    [dialog, advance, dispatch]
  )

  const cancelTask = useCallback(
    (id: string): void => {
      const task = tasksRef.current.tasks.find((t) => t.id === id)
      if (!task) return
      if (task.status === 'running') {
        window.ashirs.cancelChat()
      } else if (task.status === 'queued') {
        dispatch({ type: 'CANCEL_QUEUED', id })
      }
    },
    [dispatch]
  )

  const canAssign = useCallback((agentId: AgentId): boolean => {
    const agent = TOWN_AGENTS.find((a) => a.id === agentId)
    return !!agent?.connected && !agentBusy(tasksRef.current, agentId)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!focusedRef.current || dialog) return
      const active = document.activeElement?.tagName ?? ''
      if (active === 'INPUT' || active === 'TEXTAREA' || active === 'SELECT') return
      if (ARROW_KEYS.has(event.key)) event.preventDefault()
      if (MOVE_KEYS[event.key]) {
        keys.current.add(event.key)
        return
      }
      if (event.key === 'e' || event.key === 'E') {
        const index = nearestAgent(playerRef.current, agentsPosRef.current)
        const target = index !== null ? AGENT_IDS[index] : undefined
        if (target) openDialog(target)
        keys.current.clear()
      }
    }
    const onKeyUp = (event: KeyboardEvent): void => {
      keys.current.delete(event.key)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [dialog, openDialog])

  useEffect(() => {
    if (!focused || dialog) return
    const id = window.setInterval(() => {
      const moved: boolean[] = AGENT_IDS.map(() => false)

      let nextPlayer = playerRef.current
      for (const key of keys.current) {
        const dir = MOVE_KEYS[key]
        if (!dir) continue
        const candidate = movePlayer(map.current, playerRef.current, dir.dx, dir.dy)
        if (candidate.x !== playerRef.current.x || candidate.y !== playerRef.current.y) {
          nextPlayer = candidate
          break
        }
      }
      if (nextPlayer.x !== playerRef.current.x || nextPlayer.y !== playerRef.current.y) {
        playerRef.current = nextPlayer
        setPlayer({ ...nextPlayer })
      }

      const now = Date.now()
      const spots = [...agentsPosRef.current]
      AGENT_IDS.forEach((agent, index) => {
        const taskFor = tasksRef.current.tasks.some(
          (t) => t.agentId === agent && (t.status === 'queued' || t.status === 'running')
        )
        if (taskFor) return
        const config = TOWN_AGENTS.find((a) => a.id === agent)
        if (!config?.connected) return
        if (reducedRef.current) return
        const home = AGENT_SPOTS[index]

        const path = paths.current[index]
        if (path && path.length > 0) {
          const next = path.shift()
          if (next) {
            spots[index] = next
            moved[index] = true
          }
          return
        }
        if (path && path.length === 0) {
          paths.current[index] = null
          standby.current[index] = now + 1400
        }
        const until = standby.current[index]
        if (until !== undefined && now < until) return
        if (!home) return
        const current = spots[index]
        if (!current) return
        const atHome = current.x === home.x
        const wanderTarget = atHome ? COFFEE_SPOT : home
        if (Math.random() < WANDER_CHANCE) {
          const route = bfsPath(map.current, current, wanderTarget)
          paths.current[index] = route
          if (route && route.length > 0) moved[index] = true
        }
      })
      const prev = agentsPosRef.current
      const changed = spots.some((p, i) => {
        const before = prev[i]
        return !before || p.x !== before.x
      })
      if (changed) {
        agentsPosRef.current = spots
        setAgentsPos(spots.map((p) => ({ ...p })))
      }
      setMoves(moved)
    }, STEP_MS)
    return () => window.clearInterval(id)
  }, [focused, dialog])

  const queueCount = taskState.tasks.filter((t) => t.status === 'queued').length
  const poses = derivePose(taskState, moves, flash, approvalOpen)

  const agents = TOWN_AGENTS.map((config) => {
    const index = AGENT_IDS.indexOf(config.id)
    const pos = agentsPos[index]
    const pose = poses[config.id]
    if (!pos || !pose) return null
    return {
      id: config.id,
      title: config.title,
      domain: config.domain,
      connected: config.connected,
      pos,
      pose
    }
  }).filter((agent): agent is NonNullable<typeof agent> => agent !== null)

  return {
    player,
    agents,
    tasks: taskState.tasks,
    queueCount,
    moves,
    dialog,
    openDialog,
    closeDialog,
    submitDialog,
    cancelTask,
    canAssign
  }
}
