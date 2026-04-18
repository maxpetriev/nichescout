import { contextBridge, ipcRenderer } from 'electron'
import type { AgentEvent, ResearchResult } from '../../lib/types'

contextBridge.exposeInMainWorld('api', {
  // Credentials
  saveCreds: (creds: { x: { username: string; password: string }; reddit: { username: string; password: string } }) =>
    ipcRenderer.invoke('creds:save', creds),
  getCreds: () => ipcRenderer.invoke('creds:get'),
  hasCreds: () => ipcRenderer.invoke('creds:has'),

  // Research
  startResearch: (prompt: string, platforms: ('x' | 'reddit')[]) =>
    ipcRenderer.send('research:start', { prompt, platforms }),
  stopResearch: () => ipcRenderer.send('research:stop'),

  // Events from main → renderer
  onEvent: (cb: (e: AgentEvent) => void) => {
    ipcRenderer.on('research:event', (_, e) => cb(e))
  },
  offEvents: () => ipcRenderer.removeAllListeners('research:event'),

  // History
  listHistory: () => ipcRenderer.invoke('history:list'),
  getHistory: (id: string) => ipcRenderer.invoke('history:get', id),
})

