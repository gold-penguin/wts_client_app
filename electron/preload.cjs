const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wtsElectron', {
  notifyAuthChanged: () => ipcRenderer.send('auth-changed'),
  hideWidget: () => ipcRenderer.send('hide-widget'),
  log: {
    error: (...args) => ipcRenderer.send('log-error', ...args),
    warn: (...args) => ipcRenderer.send('log-warn', ...args),
    info: (...args) => ipcRenderer.send('log-info', ...args),
  },
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
  updater: {
    check: () => ipcRenderer.send('updater:check'),
    install: () => ipcRenderer.send('updater:install'),
    getStatus: () => ipcRenderer.invoke('updater:get-status'),
    onStatus: (cb) => {
      const handler = (_e, payload) => cb(payload);
      ipcRenderer.on('updater:status', handler);
      return () => ipcRenderer.removeListener('updater:status', handler);
    },
  },
});
