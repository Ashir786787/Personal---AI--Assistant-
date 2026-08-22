import { execFile } from 'node:child_process'

const PS_ARGS = ['-NoProfile', '-NonInteractive', '-Command'] as const

export function setVolume(level: number): Promise<void> {
  const safeLevel = Math.max(0, Math.min(100, Math.round(level)))
  const presses = Math.round(safeLevel / 2)
  const script = [
    'Add-Type -TypeDefinition \'using System; using System.Runtime.InteropServices; public class K { [DllImport("user32.dll")] public static extern void keybd_event(byte k, byte e, uint f, UIntPtr x); }\'',
    '[K]::keybd_event(0xAD,0,1,[UIntPtr]::Zero); [K]::keybd_event(0xAD,0,2,[UIntPtr]::Zero)',
    'for ($i=0; $i -lt 50; $i++) { [K]::keybd_event(0xAE,0,1,[UIntPtr]::Zero); [K]::keybd_event(0xAE,0,2,[UIntPtr]::Zero) }',
    `for ($i=0; $i -lt ${presses}; $i++) { [K]::keybd_event(0xAF,0,1,[UIntPtr]::Zero); [K]::keybd_event(0xAF,0,2,[UIntPtr]::Zero) }`
  ].join('; ')

  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      [...PS_ARGS, script],
      { timeout: 20_000, windowsHide: true },
      (err) => {
        if (err) reject(new Error('Windows refused the volume change'))
        else resolve()
      }
    )
  })
}

export function toggleMute(): Promise<void> {
  const script = [
    'Add-Type -TypeDefinition \'using System; using System.Runtime.InteropServices; public class K2 { [DllImport("user32.dll")] public static extern void keybd_event(byte k, byte e, uint f, UIntPtr x); }\'',
    '[K2]::keybd_event(0xAD,0,1,[UIntPtr]::Zero); [K2]::keybd_event(0xAD,0,2,[UIntPtr]::Zero)'
  ].join('; ')

  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      [...PS_ARGS, script],
      { timeout: 20_000, windowsHide: true },
      (err) => {
        if (err) reject(new Error('Windows refused the mute toggle'))
        else resolve()
      }
    )
  })
}
