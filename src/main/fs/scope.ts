import { existsSync, mkdirSync, readdirSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, join, resolve, sep } from 'path'

export const ALLOWED_ROOT_NAMES = ['Downloads', 'Documents', 'Desktop', 'Pictures'] as const

let cachedRoots: string[] | null = null
let rootsOverride: string[] | null = null

export function setAllowedRootsOverride(roots: string[] | null): void {
  rootsOverride = roots
  cachedRoots = null
}

export function allowedRoots(): string[] {
  if (rootsOverride) return rootsOverride
  if (!cachedRoots) {
    const home = homedir()
    cachedRoots = ALLOWED_ROOT_NAMES.map((name) => join(home, name))
    for (const root of cachedRoots) {
      if (!existsSync(root)) mkdirSync(root, { recursive: true })
    }
  }
  return cachedRoots
}

export class PathScopeError extends Error {}

function findContainingRoot(candidate: string): string | null {
  const normalizedWithSep = candidate.endsWith(sep) ? candidate : candidate + sep
  for (const root of allowedRoots()) {
    const rootWithSep = root.endsWith(sep) ? root : root + sep
    if (normalizedWithSep.toLowerCase().startsWith(rootWithSep.toLowerCase())) return root
  }
  return null
}

export interface ResolvedPath {
  absolutePath: string
  root: string
}

function rootByName(name: string): string | null {
  const lowered = name.toLowerCase()
  return (
    allowedRoots().find((root) => (root.split(/[\\/]+/).pop() ?? '').toLowerCase() === lowered) ??
    null
  )
}

export function resolveWithin(userInput: string): ResolvedPath {
  const trimmed = userInput.trim()
  if (trimmed.length === 0) throw new PathScopeError('No folder was specified')

  let candidate: string
  if (isAbsolute(trimmed)) {
    candidate = resolve(trimmed)
  } else {
    const segments = trimmed.split(/[\\/]+/).filter(Boolean)
    const firstSegment = segments[0] ?? ''
    const namedRoot = rootByName(firstSegment)

    if (namedRoot && segments.length === 1) {
      candidate = namedRoot
    } else if (namedRoot) {
      candidate = join(namedRoot, ...segments.slice(1))
    } else {
      const guessedRoot = allowedRoots().find((root) => existsSync(join(root, firstSegment)))
      if (!guessedRoot || !firstSegment) {
        throw new PathScopeError(
          'Could not match that folder inside Downloads, Documents, Desktop or Pictures'
        )
      }
      candidate = join(guessedRoot, ...segments)
    }
  }

  const containingRoot = findContainingRoot(candidate)
  if (!containingRoot) {
    throw new PathScopeError(
      'That location is outside the assistant\u2019s sandbox. Only Downloads, Documents, Desktop and Pictures are accessible'
    )
  }

  if (!existsSync(candidate)) {
    throw new PathScopeError(`That folder does not exist: ${trimmed}`)
  }

  let canonical = candidate
  try {
    canonical = realpathSync(candidate)
  } catch {
    throw new PathScopeError('That folder could not be verified on disk')
  }

  if (!canonical.toLowerCase().startsWith(containingRoot.toLowerCase())) {
    throw new PathScopeError(
      'A shortcut redirection tried to move outside the sandbox. Blocked for your safety'
    )
  }

  return { absolutePath: canonical, root: containingRoot }
}

export function listSafeRootSummaries(): Array<{ name: string; path: string; entries: number }> {
  return allowedRoots().map((root) => ({
    name: root.split(sep).pop() ?? root,
    path: root,
    entries: readdirSync(root).length
  }))
}
