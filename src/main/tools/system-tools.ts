import type { ToolDefinition } from '@shared/tools'
import type { ActionProposal } from '@shared/ipc'
import { createProposal } from './proposals'
import { listSupportedApps } from '../system/apps'

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
    description: `Propose launching an approved app. Allowed names: ${listSupportedApps()
      .map((a) => `"${a}"`)
      .join(', ')}. Anything else is refused`,
    mutating: false,

    async execute(args) {
      const app = typeof args['app'] === 'string' ? args['app'].trim() : ''
      if (!app) {
        return `TOOL_ERROR: launch_app needs {"app": "notepad"}. Approved apps: ${listSupportedApps().join(', ')}`
      }
      const proposal = createProposal({ kind: 'launch', payload: { app } })
      emitProposal({
        id: proposal.id,
        title: `Launch ${app}`,
        detailLines: [
          `Starts "${app}" using Windows. If it is not installed, nothing happens.`,
          'Only vetted apps can ever be launched by this assistant.'
        ],
        totalMoves: 1
      })
      return `A confirmation dialog to launch "${app}" was shown. Wait for the user decision`
    }
  }

  return [setVolumeTool, muteTool, brightnessTool, launchAppTool]
}
