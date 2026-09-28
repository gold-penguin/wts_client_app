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
  naver: {
    status: () => ipcRenderer.invoke('naver:status'),
    connect: (creds) => ipcRenderer.invoke('naver:connect', creds),
    listCalendars: () => ipcRenderer.invoke('naver:listCalendars'),
    selectCalendar: (arg) => ipcRenderer.invoke('naver:selectCalendar', arg),
    disconnect: () => ipcRenderer.invoke('naver:disconnect'),
    fetchEvents: (range) => ipcRenderer.invoke('naver:fetchEvents', range),
    createEvent: (fields) => ipcRenderer.invoke('naver:createEvent', fields),
    updateEvent: (arg) => ipcRenderer.invoke('naver:updateEvent', arg),
    deleteEvent: (arg) => ipcRenderer.invoke('naver:deleteEvent', arg),
  },
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
