const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const isDev = !app.isPackaged;
let mainWindow = null;
const gotSingleInstanceLock = app.requestSingleInstanceLock();
const DEFAULT_TASK_VIEW = 'table';
const TASK_VIEW_VALUES = new Set([DEFAULT_TASK_VIEW, 'kanban']);

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

function normalizeDefaultTaskView(defaultTaskView) {
  return TASK_VIEW_VALUES.has(defaultTaskView) ? defaultTaskView : DEFAULT_TASK_VIEW;
}

function normalizeAppSettings(settings = {}) {
  return {
    databasePath:
      typeof settings.databasePath === 'string' && settings.databasePath.trim()
        ? settings.databasePath
        : '',
    defaultTaskView: normalizeDefaultTaskView(settings.defaultTaskView),
  };
}

async function readAppSettings() {
  return normalizeAppSettings(await readSettings());
}

async function writeAppSettings(settings) {
  const currentSettings = await readSettings();
  const updates =
    settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {};
  const nextSettings = { ...currentSettings };

  if (Object.prototype.hasOwnProperty.call(updates, 'databasePath')) {
    nextSettings.databasePath =
      typeof updates.databasePath === 'string' ? updates.databasePath : '';
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'defaultTaskView')) {
    nextSettings.defaultTaskView = normalizeDefaultTaskView(updates.defaultTaskView);
  }

  await writeSettings(nextSettings);

  return normalizeAppSettings(nextSettings);
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

function createDatabaseReadError(databasePath, reason) {
  return new Error(`${path.basename(databasePath)} is not a valid Task Tracker database: ${reason}`);
}

function createEmptyTaskDatabase() {
  return {
    projects: {},
    tasks: {},
  };
}

function createId() {
  return randomUUID();
}

function getProjectNumberKey(projectNumber) {
  return String(projectNumber || '').trim().toLowerCase();
}

function normalizeFolderPath(folderPath) {
  return typeof folderPath === 'string' ? folderPath.trim() : '';
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const parsedDate = new Date(year, month - 1, day);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function normalizeDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return '';
  }

  const parsedDate = parseDateKey(value);

  if (!parsedDate) {
    return '';
  }

  return formatDateKey(parsedDate) === value ? value : '';
}

function addProjectRecord(
  projects,
  projectIdsByNumber,
  projectNumber,
  projectName,
  updatedAt = '',
  projectId = '',
  folderPath = '',
) {
  const trimmedProjectNumber = String(projectNumber || '').trim();
  const trimmedProjectName = String(projectName || '').trim();

  if (!trimmedProjectNumber || !trimmedProjectName) {
    return '';
  }

  const projectNumberKey = getProjectNumberKey(trimmedProjectNumber);
  const trimmedProjectId = String(projectId || '').trim();
  const fallbackProjectId =
    trimmedProjectId && getProjectNumberKey(trimmedProjectId) !== projectNumberKey
      ? trimmedProjectId
      : '';
  const normalizedProjectId =
    projectIdsByNumber.get(projectNumberKey) || fallbackProjectId || createId();

  projects[normalizedProjectId] = {
    id: normalizedProjectId,
    projectNumber: trimmedProjectNumber,
    projectName: trimmedProjectName,
    folderPath: normalizeFolderPath(folderPath),
    updatedAt,
  };
  projectIdsByNumber.set(projectNumberKey, normalizedProjectId);

  return normalizedProjectId;
}

function normalizeProjects(savedProjects) {
  const projects = {};
  const projectIdsByNumber = new Map();

  if (savedProjects && typeof savedProjects === 'object' && !Array.isArray(savedProjects)) {
    Object.entries(savedProjects).forEach(([projectKey, project]) => {
      if (project && typeof project === 'object') {
        addProjectRecord(
          projects,
          projectIdsByNumber,
          project.projectNumber || projectKey,
          project.projectName,
          project.updatedAt,
          project.id || projectKey,
          project.folderPath,
        );
      }
    });
  }

  return {
    projects,
    projectIdsByNumber,
  };
}

function normalizeTaskRecord(task, projects, projectIdsByNumber) {
  if (!task || typeof task !== 'object') {
    return null;
  }

  const createdAt =
    typeof task.createdAt === 'string' && !Number.isNaN(Date.parse(task.createdAt))
      ? task.createdAt
      : new Date().toISOString();
  let projectId = String(task.projectId || '').trim();

  if (!projectId || !projects[projectId]) {
    projectId = addProjectRecord(
      projects,
      projectIdsByNumber,
      task.projectNumber,
      task.projectName,
      createdAt,
    );
  }

  if (!projectId || !projects[projectId]) {
    return null;
  }

  const weekStart = task.weekStart || '';

  return {
    id: task.id || createId(),
    projectId,
    description: task.description || '',
    note: task.note === undefined || task.note === null ? '' : String(task.note),
    status: task.status || 'Not started',
    createdAt,
    weekStart,
    dueDate: normalizeDateKey(task.dueDate),
  };
}

function getCurrentYearKey() {
  return String(new Date().getFullYear());
}

function getYearKeyFromDateValue(value) {
  const stringValue = String(value || '').trim();
  const yearMatch = stringValue.match(/^(\d{4})/);

  if (yearMatch) {
    return yearMatch[1];
  }

  const parsedTime = Date.parse(stringValue);

  if (Number.isNaN(parsedTime)) {
    return '';
  }

  return String(new Date(parsedTime).getFullYear());
}

function getTaskYear(task) {
  return (
    getYearKeyFromDateValue(task?.weekStart) ||
    getYearKeyFromDateValue(task?.createdAt) ||
    getCurrentYearKey()
  );
}

function addTaskToYear(tasksByYear, task) {
  const year = getTaskYear(task);

  tasksByYear[year] = [...(tasksByYear[year] || []), task];
}

function normalizeTasksByYear(savedTasks, projects, projectIdsByNumber) {
  const tasksByYear = {};

  function normalizeAndAddTask(task) {
    const normalizedTask = normalizeTaskRecord(task, projects, projectIdsByNumber);

    if (normalizedTask) {
      addTaskToYear(tasksByYear, normalizedTask);
    }
  }

  if (Array.isArray(savedTasks)) {
    savedTasks.forEach(normalizeAndAddTask);
    return tasksByYear;
  }

  if (!savedTasks || typeof savedTasks !== 'object') {
    return tasksByYear;
  }

  Object.values(savedTasks).forEach((yearTasks) => {
    if (Array.isArray(yearTasks)) {
      yearTasks.forEach(normalizeAndAddTask);
    }
  });

  return tasksByYear;
}

function normalizeTaskDatabase(database) {
  const normalizedProjects = normalizeProjects(database?.projects);
  const tasks = normalizeTasksByYear(
    database?.tasks,
    normalizedProjects.projects,
    normalizedProjects.projectIdsByNumber,
  );

  return {
    projects: normalizedProjects.projects,
    tasks,
  };
}

function serializeTaskDatabase(database) {
  return JSON.stringify(normalizeTaskDatabase(database), null, 2);
}

function parseTaskDatabase(fileContents, databasePath) {
  let savedDatabase;

  try {
    savedDatabase = JSON.parse(fileContents);
  } catch {
    throw createDatabaseReadError(databasePath, 'the file is not valid JSON');
  }

  if (Array.isArray(savedDatabase)) {
    return normalizeTaskDatabase({
      projects: {},
      tasks: savedDatabase,
    });
  }

  if (
    savedDatabase &&
    typeof savedDatabase === 'object' &&
    !Array.isArray(savedDatabase) &&
    savedDatabase.projects &&
    typeof savedDatabase.projects === 'object' &&
    !Array.isArray(savedDatabase.projects) &&
    savedDatabase.tasks &&
    typeof savedDatabase.tasks === 'object'
  ) {
    return normalizeTaskDatabase(savedDatabase);
  }

  throw createDatabaseReadError(
    databasePath,
    'expected an object with projects and tasks',
  );
}

async function readTaskDatabaseFromPath(databasePath) {
  await fs.mkdir(path.dirname(databasePath), { recursive: true });

  try {
    const fileContents = await fs.readFile(databasePath, 'utf8');
    const trimmedContents = fileContents.trim();

    if (!trimmedContents) {
      const emptyDatabase = createEmptyTaskDatabase();
      await writeTaskDatabaseToPath(databasePath, emptyDatabase);
      return emptyDatabase;
    }

    const database = parseTaskDatabase(fileContents, databasePath);
    const normalizedContents = serializeTaskDatabase(database);

    if (trimmedContents !== normalizedContents) {
      await fs.writeFile(databasePath, normalizedContents, 'utf8');
    }

    return database;
  } catch (error) {
    if (error.code === 'ENOENT') {
      const emptyDatabase = createEmptyTaskDatabase();
      await writeTaskDatabaseToPath(databasePath, emptyDatabase);
      return emptyDatabase;
    }

    console.error('Failed to read tasks database:', error);
    throw error;
  }
}

async function writeTaskDatabaseToPath(databasePath, database) {
  const nextDatabase = normalizeTaskDatabase(database);

  await fs.mkdir(path.dirname(databasePath), { recursive: true });
  await fs.writeFile(databasePath, serializeTaskDatabase(nextDatabase), 'utf8');

  return nextDatabase;
}

async function readTaskDatabase() {
  return readTaskDatabaseFromPath(await getDatabasePath());
}

async function writeTaskDatabase(database) {
  return writeTaskDatabaseToPath(await getDatabasePath(), database);
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
      ...(await readTaskDatabaseFromPath(currentDatabasePath)),
    };
  }

  const databasePath = result.filePaths[0];
  const database = await readTaskDatabaseFromPath(databasePath);

  await setDatabasePath(databasePath);

  return {
    canceled: false,
    databasePath,
    ...database,
  };
}

async function chooseProjectFolder(browserWindow, currentFolderPath = '') {
  const trimmedFolderPath = normalizeFolderPath(currentFolderPath);
  const dialogOptions = {
    title: 'Choose project folder',
    properties: ['openDirectory', 'createDirectory'],
  };

  if (trimmedFolderPath) {
    dialogOptions.defaultPath = trimmedFolderPath;
  }

  const result = browserWindow
    ? await dialog.showOpenDialog(browserWindow, dialogOptions)
    : await dialog.showOpenDialog(dialogOptions);

  if (result.canceled || result.filePaths.length === 0) {
    return {
      canceled: true,
      folderPath: trimmedFolderPath,
    };
  }

  return {
    canceled: false,
    folderPath: result.filePaths[0],
  };
}

async function openProjectFolder(folderPath) {
  // Keep this path read-only: validate, open with shell.openPath, then return.
  const trimmedFolderPath = normalizeFolderPath(folderPath);

  if (!trimmedFolderPath) {
    return {
      ok: false,
      error: 'Project folder path is empty.',
    };
  }

  const errorMessage = await shell.openPath(trimmedFolderPath);

  if (errorMessage) {
    return {
      ok: false,
      error: errorMessage,
    };
  }

  return {
    ok: true,
  };
}

function registerTaskDatabaseHandlers() {
  ipcMain.handle('tasks:read-database', readTaskDatabase);
  ipcMain.handle('tasks:write-database', (_event, database) => writeTaskDatabase(database));
  ipcMain.handle('tasks:path', () => getDatabasePath());
  ipcMain.handle('tasks:read-settings', readAppSettings);
  ipcMain.handle('tasks:write-settings', (_event, settings) => writeAppSettings(settings));
  ipcMain.handle('tasks:choose-database', (event) => {
    return chooseDatabaseFile(BrowserWindow.fromWebContents(event.sender));
  });
  ipcMain.handle('tasks:choose-project-folder', (event, currentFolderPath) => {
    return chooseProjectFolder(BrowserWindow.fromWebContents(event.sender), currentFolderPath);
  });
  ipcMain.handle('tasks:open-project-folder', (_event, folderPath) => {
    return openProjectFolder(folderPath);
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
