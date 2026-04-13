const { app, BrowserWindow, Tray, Menu, globalShortcut, nativeImage, screen, ipcMain, dialog } = require('electron');
const path = require('path');
const log = require('electron-log/main');
const { autoUpdater } = require('electron-updater');

// Log configuration
log.initialize();
log.transports.file.maxSize = 5 * 1024 * 1024; // 5MB
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}';
log.errorHandler.startCatching();

// Replace console with log
Object.assign(console, log.functions);

// Windows taskbar pinning support
app.setAppUserModelId('com.mocomsys.wts');

let mainWindow = null;
let widgetWindow = null;
let tray = null;
const isDev = !app.isPackaged;

function getUrl(hash) {
  if (isDev) {
    return `http://localhost:5173/#${hash}`;
  }
  const indexPath = path.join(__dirname, '..', 'dist', 'index.html').replace(/\\/g, '/');
  return `file:///${indexPath}#${hash}`;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    title: 'WTS - 업무일지',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    show: false,
  });

  mainWindow.loadURL(getUrl('/'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createWidget() {
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;

  widgetWindow = new BrowserWindow({
    width: 340,
    height: 480,
    x: screenW - 360,
    y: screenH - 500,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    title: 'WTS Widget',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    show: false,
  });

  widgetWindow.loadURL(getUrl('/widget'));

  widgetWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      widgetWindow.hide();
    }
  });
}

function syncAuthToWidget() {
  if (!mainWindow || !widgetWindow) return;

  // Read auth from main window's localStorage, then push to widget
  mainWindow.webContents.executeJavaScript('localStorage.getItem("wts_user")')
    .then((userData) => {
      if (userData) {
        widgetWindow.webContents.executeJavaScript(
          `localStorage.setItem("wts_user", ${JSON.stringify(userData)}); window.dispatchEvent(new Event("auth-sync"));`
        );
      }
    })
    .catch((err) => log.error('[Auth sync]', err));
}

function toggleWidget() {
  if (!widgetWindow) return;
  if (widgetWindow.isVisible()) {
    widgetWindow.hide();
  } else {
    // Sync auth before showing
    syncAuthToWidget();
    widgetWindow.show();
    widgetWindow.focus();
  }
}

// IPC: main window notifies after login/logout so widget stays in sync
ipcMain.on('auth-changed', () => {
  syncAuthToWidget();
});

// IPC: widget requests to hide itself
ipcMain.on('hide-widget', () => {
  if (widgetWindow) {
    widgetWindow.hide();
  }
});

// IPC: renderer log forwarding
ipcMain.on('log-error', (_e, ...args) => log.error('[Renderer]', ...args));
ipcMain.on('log-warn', (_e, ...args) => log.warn('[Renderer]', ...args));
ipcMain.on('log-info', (_e, ...args) => log.info('[Renderer]', ...args));

// ── Auto Updater ──
function setupAutoUpdater() {
  autoUpdater.logger = log;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    log.info('[Updater] Checking for update...');
  });

  autoUpdater.on('update-available', (info) => {
    log.info(`[Updater] Update available: v${info.version}`);
  });

  autoUpdater.on('update-not-available', () => {
    log.info('[Updater] App is up to date');
  });

  autoUpdater.on('download-progress', (progress) => {
    log.info(`[Updater] Downloading: ${Math.round(progress.percent)}%`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info(`[Updater] Update downloaded: v${info.version}`);
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '업데이트 준비 완료',
      message: `새 버전(v${info.version})이 다운로드되었습니다.\n지금 재시작하시겠습니까?`,
      buttons: ['지금 재시작', '나중에'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) {
        app.isQuitting = true;
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', (err) => {
    log.error('[Updater] Error:', err);
  });

  autoUpdater.checkForUpdates();
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'icon.ico'));

  tray = new Tray(icon);
  tray.setToolTip('WTS - 업무일지');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '열기 (Ctrl+Shift+W)',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: '위젯 (Ctrl+Shift+D)',
      click: toggleWidget,
    },
    {
      label: '항상 위에 표시 (메인)',
      type: 'checkbox',
      checked: false,
      click: (menuItem) => {
        if (mainWindow) {
          mainWindow.setAlwaysOnTop(menuItem.checked);
        }
      },
    },
    { type: 'separator' },
    {
      label: '종료',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  log.info(`WTS App started (v${app.getVersion()})`);
  createWindow();
  createWidget();
  createTray();

  // Check for updates in production
  if (!isDev) {
    setupAutoUpdater();
  }

  // Ctrl+Shift+W: toggle main window
  const mainReg = globalShortcut.register('CommandOrControl+Shift+W', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
  console.log('[Shortcut] Ctrl+Shift+W registered:', mainReg);

  // Ctrl+Shift+D: toggle widget
  const widgetReg = globalShortcut.register('CommandOrControl+Shift+D', () => {
    toggleWidget();
  });
  console.log('[Shortcut] Ctrl+Shift+D registered:', widgetReg);
});

app.on('window-all-closed', () => {
  // Keep running in tray
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
  }
});

app.on('will-quit', () => {
  log.info('WTS App quitting');
  globalShortcut.unregisterAll();
});
