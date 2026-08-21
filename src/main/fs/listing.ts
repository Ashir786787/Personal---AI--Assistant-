import { readdir, stat } from 'node:fs/promises'
import { join } from 'path'

export interface FileEntry {
  name: string
  extension: string
  sizeBytes: number
  modifiedAt: number
  isDirectory: boolean
}

export const MAX_LISTING_ENTRIES = 2000

export async function listDirectory(absolutePath: string): Promise<FileEntry[]> {
  const names = await readdir(absolutePath)
  const entries = await Promise.all(
    names.slice(0, MAX_LISTING_ENTRIES).map(async (name) => {
      const full = join(absolutePath, name)
      try {
        const info = await stat(full)
        const dot = name.lastIndexOf('.')
        return {
          name,
          extension: dot > 0 ? name.slice(dot + 1).toLowerCase() : '',
          sizeBytes: info.isFile() ? info.size : 0,
          modifiedAt: info.mtimeMs,
          isDirectory: info.isDirectory()
        }
      } catch {
        return {
          name,
          extension: '',
          sizeBytes: 0,
          modifiedAt: 0,
          isDirectory: false
        }
      }
    })
  )
  return entries
}

export interface TypeGroup {
  extension: string
  count: number
  totalBytes: number
}

export function summarizeByType(entries: FileEntry[]): TypeGroup[] {
  const groups = new Map<string, TypeGroup>()
  for (const entry of entries) {
    if (entry.isDirectory) continue
    const key = entry.extension || 'no-extension'
    const group = groups.get(key) ?? { extension: key, count: 0, totalBytes: 0 }
    group.count += 1
    group.totalBytes += entry.sizeBytes
    groups.set(key, group)
  }
  return [...groups.values()].sort((a, b) => b.totalBytes - a.totalBytes)
}
