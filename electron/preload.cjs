const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('taskDatabase', {
  readDatabase: () => ipcRenderer.invoke('tasks:read-database'),
  writeDatabase: (database) => ipcRenderer.invoke('tasks:write-database', database),
  getPath: () => ipcRenderer.invoke('tasks:path'),
  chooseDatabase: () => ipcRenderer.invoke('tasks:choose-database'),
});
