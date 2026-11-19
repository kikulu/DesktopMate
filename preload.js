const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('mate', {
  setIgnore: v => ipcRenderer.send('set-ignore', v),
  onCommand: cb => ipcRenderer.on('cmd', (_e, c) => cb(c)),
  listCharacters: () => ipcRenderer.invoke('characters:list')
});
