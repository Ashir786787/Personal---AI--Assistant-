import { contextBridge, ipcRenderer } from 'electron'
import type { StreamEvent } from '@shared/chat'
import type {
  ActionProposal,
  AshirsBridge,
  MemorySummary,
  ProviderKeyStatus,
  SkillEntry,
  SystemStats,
  UpdateStatus,
  VoiceRecording
} from '@shared/ipc'
import { IPC } from '@shared/ipc'

const bridge: AshirsBridge = {
  sendChat: (request) => ipcRenderer.invoke(IPC.chatSend, request),
  cancelChat: () => {
    ipcRenderer.send(IPC.chatCancel)
  },
  clearChat: () => ipcRenderer.invoke(IPC.chatClear) as Promise<void>,
  onStreamEvent: (listener) => {
    const wrapped = (_event: unknown, streamEvent: StreamEvent): void => listener(streamEvent)
    ipcRenderer.on(IPC.chatStream, wrapped)
    return () => ipcRenderer.removeListener(IPC.chatStream, wrapped)
  },
  transcribeVoice: (recording: VoiceRecording) =>
    ipcRenderer.invoke(IPC.voiceTranscribe, recording),
  onProposal: (listener) => {
    const wrapped = (_event: unknown, proposal: ActionProposal): void => listener(proposal)
    ipcRenderer.on(IPC.actionProposed, wrapped)
    return () => ipcRenderer.removeListener(IPC.actionProposed, wrapped)
  },
  decideProposal: (id: string, approved: boolean) =>
    ipcRenderer.invoke(IPC.actionDecide, { id, approved }) as Promise<string>,
  getKeyStatus: () => ipcRenderer.invoke(IPC.settingsGet) as Promise<ProviderKeyStatus>,
  setProviderKey: (provider: 'gemini' | 'groq', key: string) =>
    ipcRenderer.invoke(IPC.settingsSet, { provider, key }) as Promise<void>,
  onUpdateStatus: (listener) => {
    const wrapped = (_event: unknown, status: UpdateStatus): void => listener(status)
    ipcRenderer.on(IPC.updateStatus, wrapped)
    return () => ipcRenderer.removeListener(IPC.updateStatus, wrapped)
  },
  checkForUpdates: () => ipcRenderer.invoke(IPC.updateCheck) as Promise<void>,
  installUpdate: () => ipcRenderer.invoke(IPC.updateInstall) as Promise<void>,
  getVersion: () => ipcRenderer.invoke(IPC.updateVersion) as Promise<string>,
  listSkills: () => ipcRenderer.invoke(IPC.toolsList) as Promise<SkillEntry[]>,
  systemStats: () => ipcRenderer.invoke(IPC.systemStats) as Promise<SystemStats>,
  memorySummary: () => ipcRenderer.invoke(IPC.memorySummary) as Promise<MemorySummary>,
  getWakeKey: () => ipcRenderer.invoke(IPC.wakeGet) as Promise<string | null>,
  setWakeKey: (key: string) => ipcRenderer.invoke(IPC.wakeSet, key) as Promise<void>
}

contextBridge.exposeInMainWorld('ashirs', bridge)
