import type { FileEntry } from '../fs/listing'

export interface PlannedMove {
  fileName: string
  fromFolder: string
  toSubfolder: string
}

export interface OrganizationPlan {
  moves: PlannedMove[]
  skippedFolders: number
  untouchedExtensions: string[]
}

const FOLDER_BY_EXTENSION: Record<string, string> = {
  pdf: 'Documents',
  doc: 'Documents',
  docx: 'Documents',
  txt: 'Documents',
  md: 'Documents',
  xls: 'Spreadsheets',
  xlsx: 'Spreadsheets',
  csv: 'Spreadsheets',
  jpg: 'Images',
  jpeg: 'Images',
  png: 'Images',
  gif: 'Images',
  webp: 'Images',
  mp4: 'Videos',
  mkv: 'Videos',
  avi: 'Videos',
  mov: 'Videos',
  mp3: 'Audio',
  wav: 'Audio',
  flac: 'Audio',
  zip: 'Archives',
  rar: 'Archives',
  '7z': 'Archives',
  exe: 'Installers',
  msi: 'Installers',
  iso: 'DiscImages'
}

export function planOrganization(sourceName: string, entries: FileEntry[]): OrganizationPlan {
  const moves: PlannedMove[] = []
  const untouched = new Set<string>()
  let skippedFolders = 0

  for (const entry of entries) {
    if (entry.isDirectory) {
      skippedFolders += 1
      continue
    }
    const destination = FOLDER_BY_EXTENSION[entry.extension]
    if (!destination) {
      untouched.add(entry.extension || 'no-extension')
      continue
    }
    if (destination === sourceName) continue
    moves.push({
      fileName: entry.name,
      fromFolder: sourceName,
      toSubfolder: destination
    })
  }

  return { moves, skippedFolders, untouchedExtensions: [...untouched].sort() }
}
