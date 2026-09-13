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
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

// CRITICAL: Chromium blocks port 6000 by default (X11) with ERR_UNSAFE_PORT.
// This command-line switch must be registered before app.whenReady().
app.commandLine.appendSwitch('explicitly-allowed-ports', '6000');

let mainWindow = null;
let tray = null;
let isQuitting = false;
let serverProcess = null;
let agentProcess = null;

const PORT = process.env.PORT || 6000;
const APP_URL = process.env.ELECTRON_START_URL || `http://localhost:${PORT}`;

// Project root directory
const projectRoot = app.isPackaged
  ? process.resourcesPath
  : path.resolve(__dirname, '..');

// Helper to load .env / .env.local variables
function loadEnv() {
  const envObj = {};
  const candidates = [
    path.join(projectRoot, '.env'),
    path.join(projectRoot, '.env.local'),
  ];
  for (const envFile of candidates) {
    if (fs.existsSync(envFile)) {
      try {
        const content = fs.readFileSync(envFile, 'utf8');
        content.split(/\r?\n/).forEach((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) return;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if (
              (val.startsWith('"') && val.endsWith('"')) ||
              (val.startsWith("'") && val.endsWith("'"))
            ) {
              val = val.slice(1, -1);
            }
            envObj[key] = val;
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        });
      } catch (err) {
        console.warn('Could not load environment file:', envFile, err);
      }
    }
  }
  return envObj;
}

// Check if port is open
function checkPortOnline(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}`, (res) => {
      resolve(true);
    });
    req.on('error', () => {
      resolve(false);
    });
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Start background services (Next.js server and Python Voice Agent)
function startBackgroundServices() {
  checkPortOnline(PORT).then((isUp) => {
    if (isUp) {
      console.log(`[Electron] Port ${PORT} is already active. Attaching to existing server.`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(APP_URL).catch(() => {});
      }
      return;
    }

    console.log(`[Electron] Port ${PORT} is not running. Bootstrapping background services...`);
    const envVars = { ...process.env, ...loadEnv(), PORT: String(PORT) };

    // 1. Next.js Web Server
    const hasBuiltNext = fs.existsSync(path.join(projectRoot, '.next'));
    const nextArgs = hasBuiltNext ? ['start', '-p', String(PORT)] : ['dev', '-p', String(PORT)];
    const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

    try {
      serverProcess = spawn(npxCmd, ['next', ...nextArgs], {
        cwd: projectRoot,
        env: envVars,
        stdio: 'pipe',
        windowsHide: true,
      });

      serverProcess.stdout?.on('data', (d) => {
        const text = d.toString().trim();
        console.log(`[Next.js Server]: ${text}`);
      });
      serverProcess.stderr?.on('data', (d) => {
        console.error(`[Next.js Server Err]: ${d.toString().trim()}`);
      });
      serverProcess.on('exit', (code) => {
        console.log(`[Next.js Server] exited with code ${code}`);
      });
    } catch (err) {
      console.error('[Electron] Could not spawn Next.js server:', err);
    }

    // 2. Python Voice Agent
    const agentPath = path.join(projectRoot, 'agent', 'agent.py');
    if (fs.existsSync(agentPath)) {
      const pyCmd = process.platform === 'win32' ? 'py' : 'python3';
      try {
        agentProcess = spawn(pyCmd, ['-u', 'agent/agent.py', 'dev'], {
          cwd: projectRoot,
          env: envVars,
          stdio: 'pipe',
          windowsHide: true,
        });

        agentProcess.stdout?.on('data', (d) => {
          console.log(`[Voice Agent]: ${d.toString().trim()}`);
        });
        agentProcess.stderr?.on('data', (d) => {
          console.error(`[Voice Agent Err]: ${d.toString().trim()}`);
        });
        agentProcess.on('exit', (code) => {
          console.log(`[Voice Agent] exited with code ${code}`);
        });
      } catch (e1) {
        console.warn('[Electron] Failed with py, trying python...', e1);
        try {
          agentProcess = spawn('python', ['-u', 'agent/agent.py', 'dev'], {
            cwd: projectRoot,
            env: envVars,
            stdio: 'pipe',
            windowsHide: true,
          });
        } catch (e2) {
          console.error('[Electron] Could not launch Python agent:', e2);
        }
      }
    }
  });
}

// Graceful child process termination
function stopBackgroundServices() {
  const killProc = (proc, label) => {
    if (!proc || !proc.pid) return;
    try {
      console.log(`[Electron] Terminating background ${label} (PID: ${proc.pid})...`);
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { windowsHide: true });
      } else {
        proc.kill('SIGTERM');
      }
    } catch (e) {
      // Process may already have stopped
    }
  };

  killProc(serverProcess, 'Next.js Server');
  killProc(agentProcess, 'Python Voice Agent');
  serverProcess = null;
  agentProcess = null;
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 860,
    minHeight: 620,
    frame: false,
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

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = ['media', 'mediaKeySystem', 'screen', 'notifications'];
    if (allowed.includes(permission)) {
      return callback(true);
    }
    callback(false);
  });

  mainWindow.loadURL(APP_URL).catch(() => {
    mainWindow.loadFile(path.join(__dirname, 'splash.html'));
  });

  mainWindow.webContents.on('did-fail-load', (_event, _errorCode, _errorDescription, validatedURL) => {
    if (validatedURL && validatedURL.startsWith(`http://localhost:${PORT}`)) {
      mainWindow.loadFile(path.join(__dirname, 'splash.html'));
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window-state-change', { isMaximized: true });
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window-state-change', { isMaximized: false });
  });

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
          stopBackgroundServices();
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
    mainWindow.hide();
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

ipcMain.handle('get-startup-info', () => {
  return {
    port: PORT,
    appUrl: APP_URL,
  };
});

app.whenReady().then(() => {
  startBackgroundServices();
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
  stopBackgroundServices();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopBackgroundServices();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && isQuitting) {
    stopBackgroundServices();
    app.quit();
  }
});

process.on('exit', () => {
  stopBackgroundServices();
});
