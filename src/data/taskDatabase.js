function getElectronDatabase() {
  return typeof window !== 'undefined' ? window.taskDatabase : null;
}

const APP_SETTINGS_STORAGE_KEY = 'task-tracker:app-settings';

function createEmptyTaskDatabase() {
  return {
    projects: {},
    tasks: {},
  };
}

function createDefaultAppSettings() {
  return {
    databasePath: '',
    defaultTaskView: 'table',
  };
}

function normalizeAppSettings(settings) {
  return {
    databasePath:
      typeof settings?.databasePath === 'string' && settings.databasePath.trim()
        ? settings.databasePath
        : '',
    defaultTaskView: settings?.defaultTaskView === 'kanban' ? 'kanban' : 'table',
  };
}

function isMissingIpcHandlerError(error) {
  return String(error?.message || error).includes('No handler registered');
}

function readStoredAppSettings() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {};
  }

  try {
    const storedSettings = JSON.parse(
      window.localStorage.getItem(APP_SETTINGS_STORAGE_KEY) || '{}',
    );

    return storedSettings && typeof storedSettings === 'object' && !Array.isArray(storedSettings)
      ? storedSettings
      : {};
  } catch {
    return {};
  }
}

function getStoredDefaultTaskView(storedSettings) {
  return storedSettings.defaultTaskView === 'kanban' ||
    storedSettings.defaultTaskView === 'table'
    ? storedSettings.defaultTaskView
    : '';
}

function saveStoredAppSettings(settings) {
  const storedSettings = readStoredAppSettings();
  const nextSettings = { ...storedSettings };

  if (Object.prototype.hasOwnProperty.call(settings || {}, 'databasePath')) {
    nextSettings.databasePath =
      typeof settings.databasePath === 'string' ? settings.databasePath : '';
  }

  if (Object.prototype.hasOwnProperty.call(settings || {}, 'defaultTaskView')) {
    nextSettings.defaultTaskView =
      settings.defaultTaskView === 'kanban' ? 'kanban' : 'table';
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
  }

  return normalizeAppSettings(nextSettings);
}

export function getStoredAppSettings() {
  return normalizeAppSettings({
    ...createDefaultAppSettings(),
    ...readStoredAppSettings(),
  });
}

export async function loadTaskDatabase() {
  const database = getElectronDatabase();

  if (database?.readDatabase) {
    return database.readDatabase();
  }

  return createEmptyTaskDatabase();
}

export async function saveTaskDatabase(taskDatabase) {
  const database = getElectronDatabase();
  const nextDatabase = {
    tasks:
      taskDatabase?.tasks && typeof taskDatabase.tasks === 'object' && !Array.isArray(taskDatabase.tasks)
        ? taskDatabase.tasks
        : {},
    projects: taskDatabase?.projects || {},
  };

  if (database?.writeDatabase) {
    return database.writeDatabase(nextDatabase);
  }

  return nextDatabase;
}

export async function loadAppSettings() {
  const database = getElectronDatabase();
  const storedSettings = readStoredAppSettings();
  const storedDefaultTaskView = getStoredDefaultTaskView(storedSettings);

  if (database?.readSettings) {
    try {
      return normalizeAppSettings({
        ...(await database.readSettings()),
        ...(storedDefaultTaskView ? { defaultTaskView: storedDefaultTaskView } : {}),
      });
    } catch (error) {
      if (!isMissingIpcHandlerError(error)) {
        throw error;
      }
    }
  }

  return getStoredAppSettings();
}

export async function saveAppSettings(settings) {
  const database = getElectronDatabase();
  const nextSettings = {};

  if (Object.prototype.hasOwnProperty.call(settings || {}, 'databasePath')) {
    nextSettings.databasePath =
      typeof settings.databasePath === 'string' ? settings.databasePath : '';
  }

  if (Object.prototype.hasOwnProperty.call(settings || {}, 'defaultTaskView')) {
    nextSettings.defaultTaskView =
      settings.defaultTaskView === 'kanban' ? 'kanban' : 'table';
  }

  const storedSettings = saveStoredAppSettings(nextSettings);

  if (database?.writeSettings) {
    try {
      const savedSettings = normalizeAppSettings(await database.writeSettings(nextSettings));
      saveStoredAppSettings(savedSettings);

      return savedSettings;
    } catch (error) {
      if (!isMissingIpcHandlerError(error)) {
        throw error;
      }
    }
  }

  return storedSettings;
}

export async function getTaskDatabasePath() {
  const database = getElectronDatabase();

  if (database?.getPath) {
    return database.getPath();
  }

  return '';
}

export async function chooseTaskDatabase() {
  const database = getElectronDatabase();

  if (database?.chooseDatabase) {
    return database.chooseDatabase();
  }

  return {
    canceled: true,
    databasePath: '',
    projects: {},
    tasks: {},
  };
}

export async function chooseProjectFolder(currentFolderPath = '') {
  const database = getElectronDatabase();

  if (database?.chooseProjectFolder) {
    return database.chooseProjectFolder(currentFolderPath);
  }

  return {
    canceled: true,
    folderPath: '',
  };
}

export async function openProjectFolder(folderPath) {
  const database = getElectronDatabase();

  if (database?.openProjectFolder) {
    return database.openProjectFolder(folderPath);
  }

  return {
    ok: false,
    error: 'Project folders can only be opened in the desktop app.',
  };
}
