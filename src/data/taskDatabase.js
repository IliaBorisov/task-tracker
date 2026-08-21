function getElectronDatabase() {
  return typeof window !== 'undefined' ? window.taskDatabase : null;
}

function createEmptyTaskDatabase() {
  return {
    projects: {},
    tasks: {},
  };
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
