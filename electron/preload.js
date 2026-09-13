const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  setAlwaysOnTop: (flag) => ipcRenderer.send('window-set-always-on-top', flag),
  onGlobalSummon: (callback) => {
    ipcRenderer.on('global-summon', () => callback());
  },
  onWindowStateChange: (callback) => {
    ipcRenderer.on('window-state-change', (_event, state) => callback(state));
  },
});
