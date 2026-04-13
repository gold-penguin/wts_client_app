const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wtsElectron', {
  notifyAuthChanged: () => ipcRenderer.send('auth-changed'),
  hideWidget: () => ipcRenderer.send('hide-widget'),
  log: {
    error: (...args) => ipcRenderer.send('log-error', ...args),
    warn: (...args) => ipcRenderer.send('log-warn', ...args),
    info: (...args) => ipcRenderer.send('log-info', ...args),
  },
});
