import { existsSync, mkdirSync, renameSync } from 'node:fs'
import { join } from 'path'
import type { PlannedMove } from '../tools/organizer'

export interface ExecutionResult {
  moved: number
  failed: Array<{ fileName: string; reason: string }>
}

function uniqueDestination(folder: string, fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  const stem = dot > 0 ? fileName.slice(0, dot) : fileName
  const extension = dot > 0 ? fileName.slice(dot) : ''

  let candidate = join(folder, fileName)
  let counter = 1
  while (existsSync(candidate)) {
    candidate = join(folder, `${stem} (${counter})${extension}`)
    counter += 1
  }
  return candidate
}

export function executeOrganizationPlan(sourceDir: string, moves: PlannedMove[]): ExecutionResult {
  const result: ExecutionResult = { moved: 0, failed: [] }

  for (const move of moves) {
    try {
      const from = join(sourceDir, move.fileName)
      if (!existsSync(from)) {
        result.failed.push({ fileName: move.fileName, reason: 'already gone' })
        continue
      }

      const targetFolder = join(sourceDir, move.toSubfolder)
      if (!existsSync(targetFolder)) mkdirSync(targetFolder, { recursive: true })

      const to = uniqueDestination(targetFolder, move.fileName)
      renameSync(from, to)
      result.moved += 1
    } catch (err) {
      result.failed.push({
        fileName: move.fileName,
        reason: err instanceof Error ? err.message : 'unknown failure'
      })
    }
  }

  return result
}
