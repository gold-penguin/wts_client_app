const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wtsElectron', {
  notifyAuthChanged: () => ipcRenderer.send('auth-changed'),
  hideWidget: () => ipcRenderer.send('hide-widget'),
});
