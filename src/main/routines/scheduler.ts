import { resolveWithin } from '../fs/scope'
import { listDirectory } from '../fs/listing'
import { planOrganization } from '../tools/organizer'
import { executeOrganizationPlan } from '../fs/executor'
import { listRoutines, markRoutineRun } from './store'
import { log } from '../lib/logger'

const TICK_MS = 30_000

export function dayKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`
}

export function hhmmOf(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function isRoutineDue(
  nowHHMM: string,
  targetHHMM: string,
  lastRunDayKey: string | null,
  todayKey: string
): boolean {
  if (!/^\d{2}:\d{2}$/.test(targetHHMM)) return false
  if (lastRunDayKey === todayKey) return false
  return nowHHMM >= targetHHMM
}

export async function runOrganizeRoutine(folderName: string): Promise<string> {
  const { absolutePath } = resolveWithin(folderName)
  const entries = await listDirectory(absolutePath)
  const sourceName =
    folderName
      .split(/[\\/]+/)
      .filter(Boolean)
      .pop() ?? folderName
  const plan = planOrganization(sourceName, entries)

  if (plan.moves.length === 0) {
    return `Nothing to tidy in ${sourceName}`
  }

  const result = executeOrganizationPlan(absolutePath, plan.moves)
  const failedNote = result.failed.length > 0 ? `, ${result.failed.length} failed` : ''
  return `Moved ${result.moved} file${result.moved === 1 ? '' : 's'}${failedNote}`
}

export async function tickRoutines(now = new Date()): Promise<string[]> {
  const todayKey = dayKeyOf(now)
  const nowHHMM = hhmmOf(now)
  const summaries: string[] = []

  for (const routine of listRoutines()) {
    if (!isRoutineDue(nowHHMM, routine.timeHHMM, routine.lastRunDayKey, todayKey)) continue
    try {
      const result = await runOrganizeRoutine(routine.folderName)
      markRoutineRun(routine.id, todayKey, result)
      summaries.push(`🧹 ${routine.name}: ${result}`)
      log('info', 'routine', `${routine.name} → ${result}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      markRoutineRun(routine.id, todayKey, `failed: ${message}`)
      log('warn', 'routine', `${routine.name} failed: ${message}`)
    }
  }

  return summaries
}

let timer: ReturnType<typeof setInterval> | null = null

export function startScheduler(onFired?: (summaries: string[]) => void): void {
  if (timer) return
  timer = setInterval(() => {
    void tickRoutines().then((fired) => {
      if (fired.length > 0 && onFired) onFired(fired)
    })
  }, TICK_MS)
  log('info', 'routine', `scheduler started (tick ${TICK_MS / 1000}s)`)
}
