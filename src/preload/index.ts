import { contextBridge, ipcRenderer } from 'electron'
import type { StreamEvent } from '@shared/chat'
import type { ActionProposal, AshirsBridge, VoiceRecording } from '@shared/ipc'
import { IPC } from '@shared/ipc'

const bridge: AshirsBridge = {
  sendChat: (request) => ipcRenderer.invoke(IPC.chatSend, request),
  cancelChat: () => {
    ipcRenderer.send(IPC.chatCancel)
  },
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
    ipcRenderer.invoke(IPC.actionDecide, { id, approved }) as Promise<string>
}

contextBridge.exposeInMainWorld('ashirs', bridge)
