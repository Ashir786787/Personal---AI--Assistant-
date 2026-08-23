import type { ToolDefinition } from '@shared/tools'
import type { ActionProposal } from '@shared/ipc'
import { createProposal } from './proposals'
import { listSupportedApps, sanitizeUrl } from '../system/apps'

function clampLevel(args: Record<string, unknown>): number | null {
  const raw = args['level']
  const level = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(level)) return null
  return Math.max(0, Math.min(100, Math.round(level)))
}

export function createSystemTools(
  emitProposal: (proposal: ActionProposal) => void
): ToolDefinition[] {
  const setVolumeTool: ToolDefinition = {
    name: 'set_volume',
    description: 'Propose setting the system volume to a percentage (0-100). User must approve',
    mutating: false,

    async execute(args) {
      const level = clampLevel(args)
      if (level === null) {
        return 'TOOL_ERROR: set_volume needs {"level": 40} with a number from 0 to 100'
      }
      const proposal = createProposal({ kind: 'volume', payload: { level } })
      emitProposal({
        id: proposal.id,
        title: `Set system volume to ${level}%`,
        detailLines: [`Windows master volume will be changed to about ${level}%.`],
        totalMoves: 1
      })
      return `A confirmation dialog for volume ${level}% was shown to the user. Wait for their decision. Nothing has changed yet`
    }
  }

  const muteTool: ToolDefinition = {
    name: 'toggle_mute',
    description: 'Propose toggling system mute on or off. User must approve',
    mutating: false,

    async execute() {
      const proposal = createProposal({ kind: 'mute', payload: {} })
      emitProposal({
        id: proposal.id,
        title: 'Toggle system mute',
        detailLines: ['Presses the Windows mute key — flips sound off if on, on if off.'],
        totalMoves: 1
      })
      return 'A confirmation dialog to toggle mute was shown. Wait for the user decision'
    }
  }

  const brightnessTool: ToolDefinition = {
    name: 'set_brightness',
    description:
      'Propose setting screen brightness (0-100). Only works on laptop displays; desktops get an error',
    mutating: false,

    async execute(args) {
      const level = clampLevel(args)
      if (level === null) {
        return 'TOOL_ERROR: set_brightness needs {"level": 70} with a number from 0 to 100'
      }
      const proposal = createProposal({ kind: 'brightness', payload: { level } })
      emitProposal({
        id: proposal.id,
        title: `Set screen brightness to ${level}%`,
        detailLines: [`Display brightness will be set to ${level}%.`],
        totalMoves: 1
      })
      return `A confirmation dialog for brightness ${level}% was shown. Wait for the user decision`
    }
  }

  const launchAppTool: ToolDefinition = {
    name: 'launch_app',
    description: `Propose launching an approved app, optionally opening a web address in Edge or Chrome. Allowed app names: ${listSupportedApps()
      .map((a) => `"${a}"`)
      .join(
        ', '
      )}. For a website pass {"url": "https://..."}. For a Google search use https://www.google.com/search?q=YOUR+URL+ENCODED+WORDS. Anything else is refused`,
    mutating: false,

    async execute(args) {
      const app = typeof args['app'] === 'string' ? args['app'].trim() : ''
      if (!app) {
        return `TOOL_ERROR: launch_app needs {"app": "notepad"}. Approved apps: ${listSupportedApps().join(', ')}`
      }
      const rawUrl = args['url']
      const url =
        typeof rawUrl === 'string' && rawUrl.trim().length > 0 ? sanitizeUrl(rawUrl) : null
      if (typeof rawUrl === 'string' && rawUrl.trim().length > 0 && !url) {
        return 'TOOL_ERROR: that url looked unsafe. Use a plain https:// address with normal URL-encoded characters'
      }
      const proposal = createProposal({ kind: 'launch', payload: { app, ...(url ? { url } : {}) } })
      emitProposal({
        id: proposal.id,
        title: url ? `Open ${url} in ${app}` : `Launch ${app}`,
        detailLines: [
          url
            ? `Opens this exact address in ${app}: ${url}`
            : `Starts "${app}" using Windows. If it is not installed, nothing happens.`,
          'Only vetted apps and safe https addresses can ever be used by this assistant.'
        ],
        totalMoves: 1
      })
      return `A confirmation dialog was shown to the user${url ? ` for opening ${url}` : ''}. Wait for their decision. Nothing has happened yet`
    }
  }

  return [setVolumeTool, muteTool, brightnessTool, launchAppTool]
}
