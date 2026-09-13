const {
  app,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  Tray,
  Menu,
  nativeImage,
  session,
} = require('electron');
const path = require('path');

let mainWindow = null;
let tray = null;
let isQuitting = false;

const APP_URL = process.env.ELECTRON_START_URL || 'http://localhost:3000';

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 860,
    minHeight: 620,
    frame: false, // Frameless window for sleek cyber/modern titlebar
    backgroundColor: '#09090b',
    icon: path.join(__dirname, 'icon.ico'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });

  // Automatically grant microphone and media permissions without browser prompts
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = ['media', 'mediaKeySystem', 'screen', 'notifications'];
    if (allowed.includes(permission)) {
      return callback(true);
    }
    callback(false);
  });

  // Load the voice assistant web app or fallback to splash screen if server is starting
  mainWindow.loadURL(APP_URL).catch(() => {
    mainWindow.loadFile(path.join(__dirname, 'splash.html'));
  });

  mainWindow.webContents.on('did-fail-load', (_event, _errorCode, _errorDescription, validatedURL) => {
    if (validatedURL.startsWith('http://localhost:3000')) {
      mainWindow.loadFile(path.join(__dirname, 'splash.html'));
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Broadcast window maximize/unmaximize state to frontend
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window-state-change', { isMaximized: true });
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window-state-change', { isMaximized: false });
  });

  // Minimize to tray on close unless user explicitly quits via tray
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createSystemTray() {
  const iconPath = path.join(__dirname, 'icon.png');
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } catch {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('AI Voice Assistant - Laptop Control');

  const updateContextMenu = () => {
    const isPinned = mainWindow ? mainWindow.isAlwaysOnTop() : false;
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show Assistant',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
      {
        label: 'Always On Top',
        type: 'checkbox',
        checked: isPinned,
        click: (menuItem) => {
          if (mainWindow) {
            mainWindow.setAlwaysOnTop(menuItem.checked);
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Quit Voice Agent',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]);
    tray.setContextMenu(contextMenu);
  };

  updateContextMenu();

  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
      }
    }
  });
}

function registerGlobalHotkeys() {
  // Global summon hotkey: Ctrl+Shift+Space (or Cmd+Shift+Space on Mac)
  try {
    const shortcutRegistered = globalShortcut.register('CommandOrControl+Shift+Space', () => {
      if (mainWindow) {
        if (!mainWindow.isVisible()) {
          mainWindow.show();
        }
        mainWindow.focus();
        mainWindow.webContents.send('global-summon');
      }
    });

    if (shortcutRegistered) {
      console.log('Registered global summon shortcut: CommandOrControl+Shift+Space');
    }
  } catch (err) {
    console.warn('Could not register global summon shortcut:', err);
  }
}

// Window control IPC handlers
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) {
    mainWindow.hide(); // Minimize to system tray
  }
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

ipcMain.on('window-set-always-on-top', (_event, flag) => {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(Boolean(flag));
  }
});

app.whenReady().then(() => {
  createMainWindow();
  createSystemTray();
  registerGlobalHotkeys();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && isQuitting) {
    app.quit();
  }
});
