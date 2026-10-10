import type { ToolDefinition } from '@shared/tools'
import type { ProposalCardDraft } from '@shared/ipc'
import { createProposal } from './proposals'
import { listRoutines } from '../routines/store'
import { resolveWritablePath } from '../fs/scope'

const TIME_PATTERN = /^([01]?\d|2[0-3]):([0-5]\d)$/

export function normalizeTime(raw: string): string | null {
  const match = raw.trim().match(TIME_PATTERN)
  if (!match) return null
  const hours = String(match[1]).padStart(2, '0')
  const minutes = String(match[2]).padStart(2, '0')
  return `${hours}:${minutes}`
}

export function createRoutineTools(
  emitProposal: (draft: ProposalCardDraft) => void
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

      // Resolved now, not at fire time, so the user approves a real folder and not a
      // name that could resolve somewhere else later.
      let folderPath: string
      try {
        folderPath = resolveWritablePath(rawFolder)
      } catch (err) {
        return `TOOL_ERROR: ${err instanceof Error ? err.message : String(err)}`
      }
      const folderName =
        folderPath
          .split(/[\\/]+/)
          .filter(Boolean)
          .pop() ?? folderPath
      const name = `Nightly tidy of ${folderName}`

      const proposal = createProposal({
        kind: 'schedule',
        sourceName: folderName,
        payload: { folderPath, folderName, timeHHMM, routineName: name }
      })
      emitProposal({
        id: proposal.id,
        title: `Schedule daily tidy â€” ${folderName} at ${timeHHMM}`,
        detailLines: [
          `Every day at ${timeHHMM}, this exact folder will be organized into typed subfolders:`,
          folderPath,
          'Files move without asking again once this is approved.',
          'You can cancel the routine any time by asking to delete it.'
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
          `- id ${routine.id} Â· ${routine.name} Â· daily at ${routine.timeHHMM} Â· last: ${
            routine.lastResult ?? 'never ran'
          }`
      )
      return `Scheduled routines:\n${lines.join('\n')}`
    }
  }

  const deleteRoutineTool: ToolDefinition = {
    name: 'delete_routine',
    description:
      'Propose deleting a scheduled routine by id from list_routines. Shows a confirmation dialog; the routine is only removed after the user approves',
    mutating: false,

    async execute(args) {
      const id = typeof args['id'] === 'string' ? args['id'].trim() : ''
      if (!id) return 'TOOL_ERROR: delete_routine needs {"id": "<id from list_routines>"}'
      const routine = listRoutines().find((entry) => entry.id === id)
      if (!routine) return `No routine with id ${id}. Use list_routines first`

      const proposal = createProposal({
        kind: 'deleteRoutine',
        payload: { routineId: id, routineName: routine.name }
      })
      emitProposal({
        id: proposal.id,
        title: `Delete routine "${routine.name}"`,
        detailLines: [
          `Removes the daily ${routine.timeHHMM} routine for "${routine.folderName}".`,
          'It stops tidying that folder and cannot be undone except by scheduling it again.'
        ],
        totalMoves: 1
      })
      return (
        `A confirmation dialog for deleting the routine "${routine.name}" was shown to the user. ` +
        'Wait for their decision. Nothing has been deleted yet â€” never claim otherwise'
      )
    }
  }

  return [scheduleRoutineTool, listRoutinesTool, deleteRoutineTool]
}
