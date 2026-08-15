const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('quotaDock', {
  refresh: () => ipcRenderer.invoke('usage:refresh'),
  startDsh: () => ipcRenderer.invoke('dsh:start'),
  settingsState: () => ipcRenderer.invoke('settings:state'),
  saveSettings: (values) => ipcRenderer.invoke('settings:save', values),
  addCustomProvider: (values) => ipcRenderer.invoke('custom:add', values),
  removeCustomProvider: (id) => ipcRenderer.invoke('custom:remove', id),
  connectChatGpt: () => ipcRenderer.send('chatgpt:connect'),
  minimize: () => ipcRenderer.send('app:minimize'),
  quit: () => ipcRenderer.send('app:quit'),
  openLink: (url) => ipcRenderer.send('link:open', url),
  onChatGptConnected: (callback) => ipcRenderer.on('chatgpt-connected', callback),
})
