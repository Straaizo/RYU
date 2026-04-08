const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ryu', {
  // Store
  storeGet: (key) => ipcRenderer.invoke('store:get', key),
  storeSet: (key, value) => ipcRenderer.invoke('store:set', key, value),
  storeDelete: (key) => ipcRenderer.invoke('store:delete', key),

  // Filesystem
  selectFolder: () => ipcRenderer.invoke('fs:select-folder'),
  selectFiles: () => ipcRenderer.invoke('fs:select-files'),
  indexProject: (path) => ipcRenderer.invoke('fs:index-project', path),
  readFile: (path) => ipcRenderer.invoke('fs:read-file', path),
  writeFile: (path, content) => ipcRenderer.invoke('fs:write-file', path, content),
  exists: (path) => ipcRenderer.invoke('fs:exists', path),
  openFolder: (path) => ipcRenderer.invoke('shell:open-folder', path),

  // Anthropic
  callAPI: (params) => ipcRenderer.invoke('anthropic:call', params),
  testApiKey: (apiKey) => ipcRenderer.invoke('anthropic:test-key', apiKey),

  // Menú → Renderer (devuelve función cleanup)
  onMenu: (channel, callback) => {
    const VALID = ['menu:open-folder', 'menu:reindex', 'menu:clear', 'menu:pick-files'];
    if (!VALID.includes(channel)) return () => {};
    const wrapped = (_e, ...args) => callback(...args);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },
});
