const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

const isDev = !app.isPackaged;
let mainWindow = null;
const gotSingleInstanceLock = app.requestSingleInstanceLock();

function getDefaultDatabasePath() {
  return path.join(app.getPath('userData'), 'tasks.json');
}

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

async function readSettings() {
  try {
    const fileContents = await fs.readFile(getSettingsPath(), 'utf8');
    const settings = JSON.parse(fileContents);

    return settings && typeof settings === 'object' ? settings : {};
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {};
    }

    console.error('Failed to read app settings:', error);
    return {};
  }
}

async function writeSettings(settings) {
  const settingsPath = getSettingsPath();

  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
}

async function getDatabasePath() {
  const settings = await readSettings();

  if (typeof settings.databasePath === 'string' && settings.databasePath.trim()) {
    return settings.databasePath;
  }

  return getDefaultDatabasePath();
}

async function setDatabasePath(databasePath) {
  const settings = await readSettings();

  await writeSettings({
    ...settings,
    databasePath,
  });
}

async function readTasksFromPath(databasePath) {
  await fs.mkdir(path.dirname(databasePath), { recursive: true });

  try {
    const fileContents = await fs.readFile(databasePath, 'utf8');
    const trimmedContents = fileContents.trim();

    if (!trimmedContents) {
      await writeTasksToPath(databasePath, []);
      return [];
    }

    const savedTasks = JSON.parse(fileContents);

    return Array.isArray(savedTasks) ? savedTasks : [];
  } catch (error) {
    if (error.code === 'ENOENT') {
      await writeTasksToPath(databasePath, []);
      return [];
    }

    console.error('Failed to read tasks database:', error);
    return [];
  }
}

async function writeTasksToPath(databasePath, tasks) {
  const nextTasks = Array.isArray(tasks) ? tasks : [];

  await fs.mkdir(path.dirname(databasePath), { recursive: true });
  await fs.writeFile(databasePath, JSON.stringify(nextTasks, null, 2), 'utf8');

  return nextTasks;
}

async function readTasks() {
  return readTasksFromPath(await getDatabasePath());
}

async function writeTasks(tasks) {
  return writeTasksToPath(await getDatabasePath(), tasks);
}

async function chooseDatabaseFile(browserWindow) {
  const currentDatabasePath = await getDatabasePath();
  const dialogOptions = {
    title: 'Choose task database',
    defaultPath: currentDatabasePath,
    filters: [{ name: 'JSON Files', extensions: ['json'] }],
    properties: ['openFile'],
  };
  const result = browserWindow
    ? await dialog.showOpenDialog(browserWindow, dialogOptions)
    : await dialog.showOpenDialog(dialogOptions);

  if (result.canceled || result.filePaths.length === 0) {
    return {
      canceled: true,
      databasePath: currentDatabasePath,
      tasks: await readTasksFromPath(currentDatabasePath),
    };
  }

  const databasePath = result.filePaths[0];
  await setDatabasePath(databasePath);

  return {
    canceled: false,
    databasePath,
    tasks: await readTasksFromPath(databasePath),
  };
}

function registerTaskDatabaseHandlers() {
  ipcMain.handle('tasks:read', readTasks);
  ipcMain.handle('tasks:write', (_event, tasks) => writeTasks(tasks));
  ipcMain.handle('tasks:path', () => getDatabasePath());
  ipcMain.handle('tasks:choose-database', (event) => {
    return chooseDatabaseFile(BrowserWindow.fromWebContents(event.sender));
  });
}

function focusMainWindow() {
  if (!mainWindow) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.focus();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1040,
    height: 720,
    minWidth: 760,
    minHeight: 540,
    title: 'Task Tracker',
    backgroundColor: '#f5f1e8',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', focusMainWindow);

  app.whenReady().then(() => {
    registerTaskDatabaseHandlers();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
