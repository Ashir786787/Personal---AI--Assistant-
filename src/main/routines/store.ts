import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { app } from 'electron'
import { join } from 'path'

export interface Routine {
  id: string
  name: string
  folderName: string
  timeHHMM: string
  createdAt: number
  lastRunDayKey: string | null
  lastResult: string | null
}

let cache: Routine[] | null = null
let overridePath: string | null = null

function storePath(): string {
  if (overridePath) return overridePath
  const dir = app.getPath('userData')
  return join(dir, 'routines.json')
}

function load(): Routine[] {
  if (cache) return cache
  const path = storePath()
  if (!existsSync(path)) {
    cache = []
    return cache
  }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown
    cache = Array.isArray(parsed) ? (parsed as Routine[]) : []
  } catch {
    cache = []
  }
  return cache
}

function persist(): void {
  try {
    writeFileSync(storePath(), JSON.stringify(cache ?? [], null, 2))
  } catch {
    // best-effort persistence; scheduler keeps working in memory this session
  }
}

export function setRoutinesFileForTest(path: string): void {
  overridePath = path
  cache = null
}

export function listRoutines(): Routine[] {
  return [...load()].sort((a, b) => a.timeHHMM.localeCompare(b.timeHHMM))
}

export function addRoutine(name: string, folderName: string, timeHHMM: string): Routine {
  const routine: Routine = {
    id: `rt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name,
    folderName,
    timeHHMM,
    createdAt: Date.now(),
    lastRunDayKey: null,
    lastResult: null
  }
  load().push(routine)
  persist()
  return routine
}

export function deleteRoutine(id: string): boolean {
  const before = load().length
  cache = load().filter((routine) => routine.id !== id)
  persist()
  return cache.length < before
}

export function markRoutineRun(id: string, dayKey: string, result: string): void {
  const routine = load().find((entry) => entry.id === id)
  if (!routine) return
  routine.lastRunDayKey = dayKey
  routine.lastResult = result
  persist()
}
