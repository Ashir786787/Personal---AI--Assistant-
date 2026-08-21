import { contextBridge, ipcRenderer } from 'electron'
import type { StreamEvent } from '@shared/chat'
import type { AshirsBridge } from '@shared/ipc'
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
  }
}

contextBridge.exposeInMainWorld('ashirs', bridge)
