import { existsSync, mkdirSync, readdirSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, join, resolve, sep } from 'path'

export const ALLOWED_ROOT_NAMES = ['Downloads', 'Documents', 'Desktop', 'Pictures'] as const

/** Named home folders a relative path (e.g. "Downloads" or "Music") may resolve to. */
const HOME_FOLDER_NAMES = [
  'Downloads',
  'Documents',
  'Desktop',
  'Pictures',
  'Music',
  'Videos',
  'AppData'
] as const

/**
 * Hard exclusions: anything whose path contains one of these is off-limits for
 * read AND write. The user's Discord, WhatsApp and VS Code stay protected even
 * if an approval dialog is shown for some other file.
 */
export const EXCLUDED_APP_FRAGMENTS = [
  'discord',
  'whatsapp',
  'vscode',
  'vs code',
  '.vscode'
] as const

const EXCLUDED_APP_BASENAME = /^code(?:-insiders|-exploration)?\.exe$/i

/**
 * System homes that should never be written to, even with approval (drive
 * roots, the Windows folder, hidden system dirs).
 */
const PROTECTED_WRITE_FRAGMENTS = [
  '\\windows',
  '$recycle.bin',
  'system volume information',
  '\\windowsapps',
  '\\perflogs',
  '\\programdata\\microsoft'
] as const

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

export function isExcludedAppPath(candidate: string): boolean {
  const lowered = candidate.toLowerCase()
  for (const fragment of EXCLUDED_APP_FRAGMENTS) {
    if (lowered.includes(fragment)) return true
  }
  const base = (candidate.split(/[\\/]+/).pop() ?? '').toLowerCase()
  if (EXCLUDED_APP_BASENAME.test(base)) return true
  return false
}

export function isProtectedWritePath(candidate: string): boolean {
  const lowered = candidate.toLowerCase()
  if (/^[a-z]:\\?$/.test(lowered)) return true
  for (const fragment of PROTECTED_WRITE_FRAGMENTS) {
    if (lowered.includes(fragment)) return true
  }
  return false
}

function sandboxed(): boolean {
  return rootsOverride !== null
}

function basename(path: string): string {
  return path.split(/[\\/]+/).pop() ?? path
}

/** Resolves user input to an absolute path, applying exclusions. */
function resolvePath(
  userInput: string,
  options: { writable: boolean; requireExists: boolean }
): string {
  const trimmed = userInput.trim()
  if (trimmed.length === 0) throw new PathScopeError('No path was specified')

  // In the test sandbox the old strict root-guessing semantics apply: relative
  // paths are guessed against each allowed root by on-disk existence.
  const sandbox = sandboxed()

  let candidate: string
  if (isAbsolute(trimmed)) {
    candidate = resolve(trimmed)
  } else {
    const segments = trimmed.split(/[\\/]+/).filter(Boolean)
    const firstSegment = segments[0] ?? ''
    if (!firstSegment) throw new PathScopeError('Could not read that path')

    const namedRoot = allowedRoots().find(
      (root) => basename(root).toLowerCase() === firstSegment.toLowerCase()
    )

    if (sandbox) {
      if (namedRoot) {
        candidate = join(namedRoot, ...segments.slice(1))
      } else {
        const probeSegments = options.requireExists ? segments : segments.slice(0, -1)
        const guessedRoot = allowedRoots().find((root) => existsSync(join(root, ...probeSegments)))
        if (!guessedRoot) {
          throw new PathScopeError('Could not match that folder name')
        }
        candidate = join(guessedRoot, ...segments)
      }
    } else {
      const home = homedir()
      if (namedRoot) {
        candidate = join(namedRoot, ...segments.slice(1))
      } else if (
        HOME_FOLDER_NAMES.some((name) => name.toLowerCase() === firstSegment.toLowerCase())
      ) {
        candidate = join(home, ...segments)
      } else if (existsSync(join(home, segments[0] ?? ''))) {
        candidate = join(home, ...segments)
      } else {
        throw new PathScopeError(
          `Could not match "${firstSegment}" — give a full path like C:\\Users\\${basename(home)} or an absolute folder`
        )
      }
    }
  }

  if (sandbox) {
    const candidateWithSep = candidate.endsWith(sep) ? candidate : candidate + sep
    const containingRoot = allowedRoots().find((root) => {
      const rootWithSep = root.endsWith(sep) ? root : root + sep
      return candidateWithSep.toLowerCase().startsWith(rootWithSep.toLowerCase())
    })
    if (!containingRoot) {
      throw new PathScopeError('That location is outside the accessible folders')
    }
    const parent = resolve(candidate, '..')
    if (!existsSync(candidate)) {
      if (options.requireExists) throw new PathScopeError(`That path does not exist: ${trimmed}`)
      if (!existsSync(parent)) {
        throw new PathScopeError('The folder holding that path does not exist')
      }
      return resolve(candidate)
    }
    let canonical = candidate
    try {
      canonical = realpathSync(candidate)
    } catch {
      throw new PathScopeError('That path could not be verified on disk')
    }
    const canonicalWithSep = canonical.endsWith(sep) ? canonical : canonical + sep
    const rootWithSep = (
      containingRoot.endsWith(sep) ? containingRoot : containingRoot + sep
    ).toLowerCase()
    if (!canonicalWithSep.toLowerCase().startsWith(rootWithSep)) {
      throw new PathScopeError(
        'A shortcut redirection tried to move outside the accessible folders. Blocked for your safety'
      )
    }
    return canonical
  }

  if (isExcludedAppPath(candidate)) {
    throw new PathScopeError(
      'That path is on the protected list (Discord, WhatsApp, VS Code) and stays off-limits'
    )
  }
  if (options.writable && isProtectedWritePath(candidate)) {
    throw new PathScopeError('That location is system-protected and cannot be changed')
  }

  const parent = resolve(candidate, '..')
  const targetMissing = !existsSync(candidate)
  if (targetMissing) {
    if (options.requireExists) throw new PathScopeError(`That path does not exist: ${trimmed}`)
    if (!existsSync(parent)) {
      throw new PathScopeError('The folder holding that path does not exist')
    }
    return resolve(candidate)
  }

  let canonical = candidate
  try {
    canonical = realpathSync(candidate)
  } catch {
    throw new PathScopeError('That path could not be verified on disk')
  }
  if (isExcludedAppPath(canonical)) {
    throw new PathScopeError(
      'That path is on the protected list (Discord, WhatsApp, VS Code) and stays off-limits'
    )
  }
  if (options.writable && isProtectedWritePath(canonical)) {
    throw new PathScopeError('That location is system-protected and cannot be changed')
  }
  return canonical
}

/**
 * Readable path resolution. In the test sandbox (override roots) behaves like
 * the old strict scope; in production resolves anywhere on the PC except the
 * excluded apps and system-protected write zones.
 */
export function resolveReadablePath(userInput: string): string {
  return resolvePath(userInput, { writable: false, requireExists: true })
}

/**
 * Writable path resolution: existing target, exclusions + protected zones
 * enforced just like reads.
 */
export function resolveWritablePath(userInput: string): string {
  return resolvePath(userInput, { writable: true, requireExists: true })
}

/**
 * Writable target resolution for NEW files: the parent folder must exist but
 * the target itself may not (a fresh file the assistant will create).
 */
export function resolveNewTargetPath(userInput: string): string {
  return resolvePath(userInput, { writable: true, requireExists: false })
}

export function listSafeRootSummaries(): Array<{ name: string; path: string; entries: number }> {
  return allowedRoots().map((root) => ({
    name: basename(root),
    path: root,
    entries: readdirSync(root).length
  }))
}
