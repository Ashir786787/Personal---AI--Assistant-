import { lstatSync, readdirSync } from 'node:fs'
import { join, relative } from 'path'
import { resolveWithin } from './scope'

export interface SearchHit {
  fileName: string
  relativePath: string
  sizeBytes: number
  isDirectory: boolean
}

export interface SearchLimits {
  maxDepth: number
  maxResults: number
  maxScanned: number
}

const DEFAULT_LIMITS: SearchLimits = {
  maxDepth: 6,
  maxResults: 25,
  maxScanned: 20000
}

export function searchWithin(
  userInput: string,
  rawQuery: string,
  limits: SearchLimits = DEFAULT_LIMITS
): SearchHit[] {
  const query = rawQuery.trim().toLowerCase()
  if (query.length === 0) return []

  const { absolutePath } = resolveWithin(userInput)
  const hits: SearchHit[] = []
  let scanned = 0

  type Step = 'stop' | undefined
  const visit = (dir: string, depth: number): Step => {
    if (depth > limits.maxDepth || hits.length >= limits.maxResults) return 'stop'

    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return undefined
    }

    for (const entry of entries) {
      scanned += 1
      if (scanned > limits.maxScanned || hits.length >= limits.maxResults) return 'stop'

      const fullPath = join(dir, entry.name)
      const isLink = entry.isSymbolicLink()

      if (entry.name.toLowerCase().includes(query)) {
        let size = 0
        try {
          const stats = lstatSync(fullPath)
          size = stats.isFile() ? stats.size : 0
        } catch {
          size = 0
        }
        hits.push({
          fileName: entry.name,
          relativePath: relative(absolutePath, fullPath),
          sizeBytes: size,
          isDirectory: entry.isDirectory() && !isLink
        })
      }

      if (!isLink && entry.isDirectory()) {
        if (visit(fullPath, depth + 1) === 'stop') return 'stop'
      }
    }
    return undefined
  }

  visit(absolutePath, 0)
  return hits
}
