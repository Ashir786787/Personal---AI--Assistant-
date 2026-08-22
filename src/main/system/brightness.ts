import { execFile } from 'node:child_process'

export function setBrightness(level: number): Promise<void> {
  const safeLevel = Math.max(0, Math.min(100, Math.round(level)))
  const script = `(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1, ${safeLevel})`

  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { timeout: 15_000, windowsHide: true },
      (err) => {
        if (err) {
          reject(
            new Error(
              'This display does not support brightness control (desktop monitors need their own buttons or software)'
            )
          )
        } else resolve()
      }
    )
  })
}
