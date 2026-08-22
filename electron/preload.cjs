const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('taskDatabase', {
  readDatabase: () => ipcRenderer.invoke('tasks:read-database'),
  writeDatabase: (database) => ipcRenderer.invoke('tasks:write-database', database),
  getPath: () => ipcRenderer.invoke('tasks:path'),
  readSettings: () => ipcRenderer.invoke('tasks:read-settings'),
  writeSettings: (settings) => ipcRenderer.invoke('tasks:write-settings', settings),
  chooseDatabase: () => ipcRenderer.invoke('tasks:choose-database'),
});
