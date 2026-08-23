import { safeStorage } from 'electron'
import type { MemoryCipher } from '../conversation/memory'

const ENC_PREFIX = 'dpapi:v1:'

export function createDpapiCipher(): MemoryCipher {
  let availabilityKnown = false
  let availableCache = false

  function available(): boolean {
    if (!availabilityKnown) {
      try {
        availableCache = safeStorage.isEncryptionAvailable()
      } catch {
        availableCache = false
      }
      availabilityKnown = true
    }
    return availableCache
  }

  return {
    encrypt(plain: string): string | null {
      if (!available()) return null
      try {
        return ENC_PREFIX + safeStorage.encryptString(plain).toString('base64')
      } catch {
        return null
      }
    },
    decrypt(blob: string): string | null {
      if (!blob.startsWith(ENC_PREFIX)) return null
      try {
        return safeStorage.decryptString(Buffer.from(blob.slice(ENC_PREFIX.length), 'base64'))
      } catch {
        return null
      }
    }
  }
}
