import { listDirectory, summarizeByType, type FileEntry } from '../fs/listing'
import { allowedRoots, resolveWithin } from '../fs/scope'
import type { ToolDefinition } from '@shared/tools'
import { sep } from 'path'

const MAX_LISTED_ITEMS = 40

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function describeEntry(entry: FileEntry): string {
  const kind = entry.isDirectory ? '[folder]' : `[${entry.extension || 'file'}]`
  return `${kind} ${entry.name}${entry.isDirectory ? '' : ` (${formatBytes(entry.sizeBytes)})`}`
}

export const listFolderTool: ToolDefinition = {
  name: 'list_folder',
  description: 'See what is inside a folder',
  mutating: false,

  async execute(args) {
    const raw = typeof args['path'] === 'string' ? args['path'] : ''
    const { absolutePath, root } = resolveWithin(raw)
    const entries = await listDirectory(absolutePath)

    if (entries.length === 0) return `"${raw}" is empty.`

    const visible = entries.slice(0, MAX_LISTED_ITEMS).map(describeEntry)
    const remainder = entries.length - visible.length
    return [
      `"${raw}" (${root.split(sep).pop()}) contains ${entries.length} items:`,
      ...visible,
      ...(remainder > 0 ? [`…and ${remainder} more`] : [])
    ].join('\n')
  }
}

export const folderSummaryTool: ToolDefinition = {
  name: 'folder_summary',
  description: 'Grouped overview of a folder by file type',
  mutating: false,

  async execute(args) {
    const raw = typeof args['path'] === 'string' ? args['path'] : ''
    const { absolutePath } = resolveWithin(raw)
    const entries = await listDirectory(absolutePath)

    const folders = entries.filter((e) => e.isDirectory).length
    const groups = summarizeByType(entries)
    if (groups.length === 0 && folders === 0) return `"${raw}" is empty.`

    return [
      `Summary of "${raw}": ${folders} folders, ${groups.reduce((n, g) => n + g.count, 0)} files.`,
      ...groups.map((g) => `. ${g.extension}: ${g.count} files, ${formatBytes(g.totalBytes)} total`)
    ].join('\n')
  }
}

export const sandboxOverviewTool: ToolDefinition = {
  name: 'sandbox_overview',
  description: 'Item counts for each accessible folder',
  mutating: false,

  async execute() {
    const lines = await Promise.all(
      allowedRoots().map(async (root) => {
        const name = root.split(sep).pop() ?? root
        try {
          const entries = await listDirectory(root)
          const files = entries.filter((e) => !e.isDirectory).length
          const dirs = entries.length - files
          return `${name}: ${files} files, ${dirs} folders`
        } catch {
          return `${name}: not readable`
        }
      })
    )
    return ['Accessible folders:', ...lines].join('\n')
  }
}

export function readOnlyFileTools(): ToolDefinition[] {
  return [listFolderTool, folderSummaryTool, sandboxOverviewTool]
}
