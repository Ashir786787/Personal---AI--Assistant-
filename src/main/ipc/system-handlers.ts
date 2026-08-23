import { exec } from 'node:child_process'
import os from 'node:os'
import { promisify } from 'node:util'
import { ipcMain } from 'electron'
import type { SystemStats } from '@shared/ipc'
import { IPC } from '@shared/ipc'
import type { ConversationMemory } from '../conversation/memory'
import type { ToolRegistry } from '../tools/registry'

const execAsync = promisify(exec)

interface CpuSnapshot {
  idle: number
  total: number
}

function takeCpuSnapshot(): CpuSnapshot {
  let idle = 0
  let total = 0
  for (const cpu of os.cpus()) {
    idle += cpu.times.idle
    total += cpu.times.idle + cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq
  }
  return { idle, total }
}

export function computeCpuPercent(previous: CpuSnapshot, current: CpuSnapshot): number {
  const idleDelta = current.idle - previous.idle
  const totalDelta = current.total - previous.total
  if (totalDelta <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((1 - idleDelta / totalDelta) * 100)))
}

async function readDisk(): Promise<{ freeGb: number | null; totalGb: number | null }> {
  try {
    const { stdout } = await execAsync(
      "powershell -NoProfile -Command \"Get-PSDrive C | Select-Object @{n='f';e={[math]::Round($_.Free/1GB,1)}},@{n='t';e={[math]::Round(($_.Used+$_.Free)/1GB,1)}} | ConvertTo-Json\"",
      { timeout: 8000 }
    )
    const parsed = JSON.parse(stdout) as { f?: number; t?: number }
    return {
      freeGb: typeof parsed.f === 'number' ? parsed.f : null,
      totalGb: typeof parsed.t === 'number' ? parsed.t : null
    }
  } catch {
    return { freeGb: null, totalGb: null }
  }
}

async function readBattery(): Promise<number | null> {
  try {
    const { stdout } = await execAsync(
      'powershell -NoProfile -Command "(Get-CimInstance Win32_Battery -ErrorAction Stop).EstimatedChargeRemaining"',
      { timeout: 8000 }
    )
    const value = Number(stdout.trim())
    return Number.isFinite(value) && value >= 0 ? Math.round(value) : null
  } catch {
    return null
  }
}

export function registerSystemHandlers(memory: ConversationMemory, registry: ToolRegistry): void {
  let lastCpu = takeCpuSnapshot()
  let cachedDisk = { freeGb: null as number | null, totalGb: null as number | null }
  let cachedBattery: number | null = null
  let slowLastRead = 0

  ipcMain.handle(IPC.toolsList, () =>
    registry.definitions().map((tool) => ({ name: tool.name, description: tool.description }))
  )

  ipcMain.handle(IPC.systemStats, async (): Promise<SystemStats> => {
    await new Promise((resolve) => setTimeout(resolve, 350))
    const current = takeCpuSnapshot()
    const cpuPercent = computeCpuPercent(lastCpu, current)
    lastCpu = current

    const now = Date.now()
    if (now - slowLastRead > 30_000) {
      slowLastRead = now
      void readDisk().then((disk) => {
        cachedDisk = disk
      })
      void readBattery().then((battery) => {
        if (battery !== null) cachedBattery = battery
      })
    }

    const ramTotalGb = os.totalmem() / 1024 ** 3
    const ramFreeGb = os.freemem() / 1024 ** 3
    return {
      cpuPercent,
      ramPercent: Math.round(((ramTotalGb - ramFreeGb) / ramTotalGb) * 100),
      ramUsedGb: Math.round((ramTotalGb - ramFreeGb) * 10) / 10,
      ramTotalGb: Math.round(ramTotalGb * 10) / 10,
      batteryPercent: cachedBattery,
      diskFreeGb: cachedDisk.freeGb,
      diskTotalGb: cachedDisk.totalGb,
      uptimeHours: Math.round((os.uptime() / 3600) * 10) / 10
    }
  })

  ipcMain.handle(IPC.memorySummary, () => {
    const all = memory.recent(100000)
    const oldest = all.length > 0 ? (all[0]?.createdAt ?? null) : null
    return { messageCount: all.length, oldestAt: oldest }
  })
}
