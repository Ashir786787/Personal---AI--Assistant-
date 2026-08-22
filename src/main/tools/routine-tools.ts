import type { ToolDefinition } from '@shared/tools'
import type { ActionProposal } from '@shared/ipc'
import { createProposal } from './proposals'
import { deleteRoutine, listRoutines } from '../routines/store'

const TIME_PATTERN = /^([01]?\d|2[0-3]):([0-5]\d)$/

export function normalizeTime(raw: string): string | null {
  const match = raw.trim().match(TIME_PATTERN)
  if (!match) return null
  const hours = String(match[1]).padStart(2, '0')
  const minutes = String(match[2]).padStart(2, '0')
  return `${hours}:${minutes}`
}

export function createRoutineTools(
  emitProposal: (proposal: ActionProposal) => void
): ToolDefinition[] {
  const scheduleRoutineTool: ToolDefinition = {
    name: 'schedule_routine',
    description:
      'Propose a daily routine that automatically organizes one folder at a fixed time. User must approve',
    mutating: false,

    async execute(args) {
      const rawFolder = typeof args['path'] === 'string' ? args['path'].trim() : ''
      const rawTime = typeof args['time'] === 'string' ? args['time'] : ''
      if (!rawFolder) {
        return 'TOOL_ERROR: schedule_routine needs {"path": "Downloads", "time": "21:00"}'
      }
      const timeHHMM = normalizeTime(rawTime)
      if (!timeHHMM) {
        return 'TOOL_ERROR: time must be 24-hour HH:MM, e.g. "21:00"'
      }

      const folderName =
        rawFolder
          .split(/[\\/]+/)
          .filter(Boolean)
          .pop() ?? rawFolder
      const name = `Nightly tidy of ${folderName}`

      const proposal = createProposal({
        kind: 'schedule',
        payload: { app: `${folderName}|${timeHHMM}|${name}` }
      })
      emitProposal({
        id: proposal.id,
        title: `Schedule daily tidy — ${folderName} at ${timeHHMM}`,
        detailLines: [
          `Every day at ${timeHHMM}, "${folderName}" will be organized into typed subfolders automatically.`,
          'Files move without asking again once this is approved.',
          'You can cancel the routine any time by asking me to delete it.'
        ],
        totalMoves: 1
      })
      return `A confirmation dialog for the daily "${name}" routine at ${timeHHMM} was shown. Wait for the user decision`
    }
  }

  const listRoutinesTool: ToolDefinition = {
    name: 'list_routines',
    description: 'Show all scheduled routines with their times and last results',
    mutating: false,

    async execute() {
      const routines = listRoutines()
      if (routines.length === 0) return 'No routines are scheduled'
      const lines = routines.map(
        (routine) =>
          `- ${routine.name} · daily at ${routine.timeHHMM} · last: ${routine.lastResult ?? 'never ran'}`
      )
      return `Scheduled routines:\n${lines.join('\n')}`
    }
  }

  const deleteRoutineTool: ToolDefinition = {
    name: 'delete_routine',
    description: 'Delete a scheduled routine by id from list_routines. Immediate and safe',
    mutating: false,

    async execute(args) {
      const id = typeof args['id'] === 'string' ? args['id'].trim() : ''
      if (!id) return 'TOOL_ERROR: delete_routine needs {"id": "<id from list_routines>"}'
      const deleted = deleteRoutine(id)
      return deleted ? `Routine ${id} deleted` : `No routine with id ${id}. Use list_routines first`
    }
  }

  return [scheduleRoutineTool, listRoutinesTool, deleteRoutineTool]
}
