const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectSource: () => ipcRenderer.invoke('select-source'),
  selectDest: () => ipcRenderer.invoke('select-dest'),
  getFiles: (dir) => ipcRenderer.invoke('get-files', dir),
  moveFile: (data) => ipcRenderer.invoke('move-file', data),
  saveSettings: (data) => ipcRenderer.invoke('save-settings', data),
  loadSettings: () => ipcRenderer.invoke('load-settings')
});