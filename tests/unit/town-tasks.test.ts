import { describe, expect, it } from 'vitest'
import type { AgentId } from '../../src/shared/agents'
import {
  INITIAL_TOWN_TASKS,
  TASK_QUEUE_MAX,
  agentBusy,
  derivePose,
  nextQueued,
  queueCount,
  runningTask,
  townTaskReducer,
  type TownTask
} from '../../src/renderer/src/state/townTasks'

function seed(partial: TownTask[]): { tasks: TownTask[] } {
  return { tasks: partial }
}

function queued(taskId: string, agentId: string, status: TownTask['status'] = 'queued'): TownTask {
  return {
    id: taskId,
    agentId: agentId as AgentId,
    text: `do ${taskId}`,
    status,
    createdAt: 1
  }
}

describe('town task queue (spec 5.2)', () => {
  it('queues a new task', () => {
    const state = townTaskReducer(INITIAL_TOWN_TASKS, {
      type: 'QUEUE_TASK',
      agentId: 'alice',
      text: 'tidy Downloads'
    })
    expect(state.tasks).toHaveLength(1)
    expect(state.tasks[0]!.status).toBe('queued')
    expect(state.tasks[0]!.text).toBe('tidy Downloads')
  })

  it('blocks a second task while the agent is busy (one per agent)', () => {
    const busy = seed([queued('t1', 'alice')])
    const next = townTaskReducer(busy, { type: 'QUEUE_TASK', agentId: 'alice', text: 'again' })
    expect(next).toBe(busy)
    expect(agentBusy(busy, 'alice')).toBe(true)
    expect(agentBusy(busy, 'bob')).toBe(false)
  })

  it('caps the queue at five', () => {
    const full = seed([1, 2, 3, 4, 5].map((n) => queued(`t${n}`, `alice${n}`)))
    const after = townTaskReducer(full, { type: 'QUEUE_TASK', agentId: 'bob', text: 'overflow' })
    expect(queueCount(full)).toBe(TASK_QUEUE_MAX)
    expect(after).toBe(full)
  })

  it('runs the only running task at a time', () => {
    const state = seed([queued('t1', 'alice'), queued('t2', 'bob')])
    const started = townTaskReducer(state, { type: 'START_TASK', id: 't1' })
    expect(runningTask(started)?.id).toBe('t1')
    const second = townTaskReducer(started, { type: 'START_TASK', id: 't2' })
    expect(runningTask(second)?.id).toBe('t1')
  })

  it('moves a task through queued -> running -> done', () => {
    let state = seed([queued('t1', 'alice')])
    state = townTaskReducer(state, { type: 'START_TASK', id: 't1' })
    state = townTaskReducer(state, { type: 'TASK_DONE', id: 't1' })
    expect(state.tasks[0]!.status).toBe('done')
    expect(state.tasks[0]!.finishedAt).toBeGreaterThanOrEqual(0)
    expect(runningTask(state)).toBeNull()
  })

  it('moves a task to failed and keeps the note', () => {
    let state = seed([queued('t1', 'carol')])
    state = townTaskReducer(state, { type: 'START_TASK', id: 't1' })
    state = townTaskReducer(state, { type: 'TASK_FAILED', id: 't1', note: 'timeout' })
    expect(state.tasks[0]!.status).toBe('failed')
    expect(state.tasks[0]!.note).toBe('timeout')
  })

  it('removes a queued task on cancel and finalizes a running one on cancel event', () => {
    const queuedState = seed([queued('t1', 'alice'), queued('t2', 'bob')])
    const afterQueuedCancel = townTaskReducer(queuedState, { type: 'CANCEL_QUEUED', id: 't1' })
    expect(afterQueuedCancel.tasks.map((t) => t.id)).toEqual(['t2'])

    const running = townTaskReducer(seed([queued('t3', 'carol')]), { type: 'START_TASK', id: 't3' })
    const cancelled = townTaskReducer(running, { type: 'TASK_CANCELLED', id: 't3' })
    expect(cancelled.tasks[0]!.status).toBe('cancelled')
  })

  it('nextQueued returns the first queued task only when nothing is running', () => {
    expect(nextQueued(seed([queued('a', 'alice')]))?.id).toBe('a')
    const running = townTaskReducer(seed([queued('a', 'alice')]), { type: 'START_TASK', id: 'a' })
    expect(nextQueued(running)).toBeNull()
  })

  it('derivePose maps task, flash and movement to pose', () => {
    const running = townTaskReducer(seed([queued('a', 'alice')]), { type: 'START_TASK', id: 'a' })
    const poses = derivePose(running, [false, false, false, false], {}, false, 0)
    expect(poses.alice).toBe('working')
    const waiting = derivePose(running, [false, false, false, false], {}, true, 0)
    expect(waiting.alice).toBe('needs-approval')

    const flashes = derivePose(
      INITIAL_TOWN_TASKS,
      [false, false, false, false],
      { bob: { status: 'done', at: 0 } },
      false,
      100
    )
    expect(flashes.bob).toBe('done')
    const stale = derivePose(
      INITIAL_TOWN_TASKS,
      [false, false, false, false],
      { bob: { status: 'done', at: 0 } },
      false,
      10000
    )
    expect(stale.bob).toBe('idle')

    const moving = derivePose(INITIAL_TOWN_TASKS, [false, true, false, false], {}, false, 0)
    expect(moving.bob).toBe('walking')
    expect(moving.alice).toBe('idle')
  })
})
