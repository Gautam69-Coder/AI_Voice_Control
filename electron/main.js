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

let mainWindow = null;
let tray = null;
let isQuitting = false;
let serverProcess = null;
let agentProcess = null;

// Next.js explicitly reserves port 6000 for X11 and throws an error if used.
// Port 6001 is completely free and safe.
const PORT = process.env.PORT || 6001;
const APP_URL = process.env.ELECTRON_START_URL || `http://localhost:${PORT}`;

// Project root directory
const projectRoot = 'D:\\PC-Data\\MERN\\.Projects\\AI_Voice_Control';

// Log file for debugging
const logFile = path.join(projectRoot, 'app-startup.log');
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    fs.appendFileSync(logFile, line);
  } catch (e) {}
  console.log(msg);
}

log(`Desktop app starting up. Target URL: ${APP_URL}`);
log(`Project root resolved to: ${projectRoot}`);

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
        log(`Could not load env file ${envFile}: ${err}`);
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

function findExecutable(names) {
  for (const name of names) {
    if (fs.existsSync(name)) return name;
    try {
      const out = require('child_process').execSync(`where.exe ${name}`, { encoding: 'utf8' }).trim();
      const first = out.split(/\r?\n/)[0]?.trim();
      if (first && fs.existsSync(first)) return first;
    } catch (e) {}
  }
  return names[0];
}

const nodeExe = findExecutable(['C:\\Program Files\\nodejs\\node.exe', 'node']);
const pyExe = findExecutable(['C:\\Users\\vishn\\AppData\\Local\\Programs\\Python\\Launcher\\py.exe', 'py', 'python']);

// Start background services (Next.js server and Python Voice Agent)
function startBackgroundServices() {
  checkPortOnline(PORT).then((isUp) => {
    if (isUp) {
      log(`Port ${PORT} is already active. Attaching to existing server.`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(APP_URL).catch(() => {});
      }
      return;
    }

    log(`Port ${PORT} is not running. Bootstrapping background services from ${projectRoot}...`);
    const envVars = { ...process.env, ...loadEnv(), PORT: String(PORT) };

    // 1. Next.js Web Server
    const hasBuiltNext = fs.existsSync(path.join(projectRoot, '.next'));
    const nextArgs = hasBuiltNext ? ['start', '-p', String(PORT)] : ['dev', '-p', String(PORT)];
    const nextCli = path.join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');

    try {
      log(`Launching Next.js: "${nodeExe}" "${nextCli}" ${nextArgs.join(' ')} in ${projectRoot}`);
      serverProcess = spawn(nodeExe, [nextCli, ...nextArgs], {
        cwd: projectRoot,
        env: envVars,
        stdio: 'pipe',
        windowsHide: true,
      });

      serverProcess.stdout?.on('data', (d) => {
        log(`[Next.js Server]: ${d.toString().trim()}`);
      });
      serverProcess.stderr?.on('data', (d) => {
        log(`[Next.js Server Err]: ${d.toString().trim()}`);
      });
      serverProcess.on('exit', (code) => {
        log(`[Next.js Server] exited with code ${code}`);
      });
    } catch (err) {
      log(`Failed to spawn Next.js server: ${err}`);
    }

    // 2. Python Voice Agent
    const agentPath = path.join(projectRoot, 'agent', 'agent.py');
    if (fs.existsSync(agentPath)) {
      try {
        log(`Launching Voice Agent: "${pyExe}" -u agent/agent.py dev in ${projectRoot}`);
        agentProcess = spawn(pyExe, ['-u', 'agent/agent.py', 'dev'], {
          cwd: projectRoot,
          env: envVars,
          stdio: 'pipe',
          windowsHide: true,
        });

        agentProcess.stdout?.on('data', (d) => {
          log(`[Voice Agent]: ${d.toString().trim()}`);
        });
        agentProcess.stderr?.on('data', (d) => {
          log(`[Voice Agent Err]: ${d.toString().trim()}`);
        });
        agentProcess.on('exit', (code) => {
          log(`[Voice Agent] exited with code ${code}`);
        });
      } catch (err) {
        log(`Could not launch Python agent: ${err}`);
      }
    } else {
      log(`Warning: agent script not found at ${agentPath}`);
    }
  });
}

// Graceful child process termination
function stopBackgroundServices() {
  const killProc = (proc, label) => {
    if (!proc || !proc.pid) return;
    try {
      log(`Terminating background ${label} (PID: ${proc.pid})...`);
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { windowsHide: true });
      } else {
        proc.kill('SIGTERM');
      }
    } catch (e) {}
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
      log('Registered global summon shortcut: CommandOrControl+Shift+Space');
    }
  } catch (err) {
    log(`Could not register global summon shortcut: ${err}`);
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
