const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('taskDatabase', {
  readTasks: () => ipcRenderer.invoke('tasks:read'),
  writeTasks: (tasks) => ipcRenderer.invoke('tasks:write', tasks),
  getPath: () => ipcRenderer.invoke('tasks:path'),
  chooseDatabase: () => ipcRenderer.invoke('tasks:choose-database'),
});
