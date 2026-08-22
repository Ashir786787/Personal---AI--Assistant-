import { listDirectory, summarizeByType, type FileEntry } from '../fs/listing'
import { searchWithin } from '../fs/search'
import { allowedRoots, resolveWithin } from '../fs/scope'
import { planOrganization } from './organizer'
import { createProposal } from './proposals'
import type { ToolDefinition } from '@shared/tools'
import type { ActionProposal } from '@shared/ipc'
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

export function createOrganizeFolderTool(
  emitProposal: (proposal: ActionProposal) => void
): ToolDefinition {
  return {
    name: 'organize_folder',
    description:
      'Propose organizing a folder into typed subfolders. Returns a plan and shows the user a confirmation dialog. Nothing moves until they approve',
    mutating: false,

    async execute(args) {
      const raw = typeof args['path'] === 'string' ? args['path'] : ''
      const { absolutePath } = resolveWithin(raw)
      const entries = await listDirectory(absolutePath)
      const sourceName =
        raw
          .split(/[\\/]+/)
          .filter(Boolean)
          .pop() ?? raw

      const plan = planOrganization(sourceName, entries)
      if (plan.moves.length === 0) {
        return `Nothing to organize in "${raw}". No matching files were found`
      }

      const proposal = createProposal({
        kind: 'organize',
        sourceDir: absolutePath,
        sourceName,
        payload: { moves: plan.moves }
      })

      const preview = plan.moves.slice(0, 10).map((m) => `${m.fileName} → ${m.toSubfolder}`)
      const detailLines = [
        ...preview,
        ...(plan.moves.length > 10 ? [`…and ${plan.moves.length - 10} more`] : []),
        ...(plan.skippedFolders > 0 ? [`${plan.skippedFolders} folders will be left alone`] : [])
      ]

      emitProposal({
        id: proposal.id,
        title: `Organize "${sourceName}"`,
        detailLines,
        totalMoves: plan.moves.length
      })

      return (
        `A plan proposing ${plan.moves.length} file moves was shown to the user for approval (proposal ${proposal.id}). ` +
        'Tell them to review it and press Approve or Cancel. Nothing has moved yet — never claim files were moved'
      )
    }
  }
}

const searchFilesTool: ToolDefinition = {
  name: 'search_files',
  description:
    'Search a folder and its subfolders for files by name. Use when the user asks where something is',
  mutating: false,

  async execute(args) {
    const raw = typeof args['path'] === 'string' ? args['path'] : ''
    const query = typeof args['query'] === 'string' ? args['query'] : ''
    if (query.trim().length === 0) {
      return 'SEARCH_ERROR: A search needs the query argument, e.g. {"query": "vanguard"}'
    }

    const hits = searchWithin(raw, query)
    if (hits.length === 0) {
      return `No matches for "${query}" inside ${raw} (searched subfolders too)`
    }

    const lines = hits
      .slice(0, 15)
      .map((hit) => `- ${hit.fileName}${hit.isDirectory ? '/' : ''} · ${hit.relativePath}`)
    const overflow = hits.length > 15 ? `\n…and ${hits.length - 15} more matches` : ''

    return `Found ${hits.length} match${hits.length === 1 ? '' : 'es'} for "${query}" in ${raw}:\n${lines.join('\n')}${overflow}`
  }
}

export function readOnlyFileTools(
  emitProposal: (proposal: ActionProposal) => void
): ToolDefinition[] {
  return [
    listFolderTool,
    folderSummaryTool,
    sandboxOverviewTool,
    searchFilesTool,
    createOrganizeFolderTool(emitProposal)
  ]
}
