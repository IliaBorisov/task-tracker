function getElectronDatabase() {
  return typeof window !== 'undefined' ? window.taskDatabase : null;
}

export async function loadTasks() {
  const database = getElectronDatabase();

  if (database?.readTasks) {
    return database.readTasks();
  }

  return [];
}

export async function saveTasks(tasks) {
  const database = getElectronDatabase();

  if (database?.writeTasks) {
    return database.writeTasks(tasks);
  }

  return tasks;
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
    tasks: [],
  };
}
