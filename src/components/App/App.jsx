import { useEffect, useMemo, useRef, useState } from 'react';
import ProjectTasksPage from '../ProjectTasksPage/ProjectTasksPage.jsx';
import TaskForm from '../TaskForm/TaskForm.jsx';
import TaskTable from '../TaskTable/TaskTable.jsx';
import { DEFAULT_TASK_STATUS, normalizeTaskStatus } from '../../constants/taskStatus.js';
import {
  chooseTaskDatabase,
  getTaskDatabasePath,
  loadTasks,
  saveTasks,
} from '../../data/taskDatabase.js';
import { getMondayWeekStartKey } from '../../utils/week.js';
import styles from './App.module.css';

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeTask(task) {
  const createdAt =
    typeof task.createdAt === 'string' && !Number.isNaN(Date.parse(task.createdAt))
      ? task.createdAt
      : new Date().toISOString();

  return {
    id: task.id || createId(),
    projectNumber:
      task.projectNumber === undefined || task.projectNumber === null
        ? ''
        : String(task.projectNumber),
    projectName: task.projectName || '',
    description: task.description || '',
    note: task.note === undefined || task.note === null ? '' : String(task.note),
    status: normalizeTaskStatus(task.status),
    createdAt,
    weekStart: task.weekStart || getMondayWeekStartKey(createdAt),
  };
}

function normalizeTasks(tasks) {
  if (!Array.isArray(tasks)) {
    return [];
  }

  return tasks
    .filter((task) => task && typeof task === 'object')
    .map(normalizeTask)
    .filter((task) => task.projectNumber || task.projectName || task.description);
}

function getDatabaseErrorMessage(error, fallbackMessage) {
  if (!error?.message) {
    return fallbackMessage;
  }

  return String(error.message)
    .replace(/^Error invoking remote method '[^']+':\s*/, '')
    .replace(/^Error:\s*/, '');
}

function App() {
  const shouldSkipNextSave = useRef(true);
  const [tasks, setTasks] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [databasePath, setDatabasePath] = useState('');
  const [databaseError, setDatabaseError] = useState('');
  const [selectedProjectNumber, setSelectedProjectNumber] = useState(null);
  const selectedProjectTasks = useMemo(
    () =>
      selectedProjectNumber
        ? tasks.filter((task) => task.projectNumber === selectedProjectNumber)
        : [],
    [selectedProjectNumber, tasks],
  );
  const selectedProjectName =
    selectedProjectTasks.find((task) => task.projectName)?.projectName || '';

  useEffect(() => {
    let isCanceled = false;

    async function initializeTasks() {
      try {
        const [savedTasks, savedDatabasePath] = await Promise.all([
          loadTasks(),
          getTaskDatabasePath(),
        ]);

        if (!isCanceled) {
          setTasks(normalizeTasks(savedTasks));
          setDatabasePath(savedDatabasePath);
          setDatabaseError('');
        }
      } catch (error) {
        if (!isCanceled) {
          setDatabaseError(getDatabaseErrorMessage(error, 'Could not read tasks.json'));
        }
      } finally {
        if (!isCanceled) {
          setIsLoaded(true);
        }
      }
    }

    initializeTasks();

    return () => {
      isCanceled = true;
    };
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return undefined;
    }

    let isCanceled = false;

    async function persistTasks() {
      if (shouldSkipNextSave.current) {
        shouldSkipNextSave.current = false;
        return;
      }

      try {
        await saveTasks(tasks);

        if (!isCanceled) {
          setDatabaseError('');
        }
      } catch (error) {
        if (!isCanceled) {
          setDatabaseError(getDatabaseErrorMessage(error, 'Could not save tasks.json'));
        }
      }
    }

    persistTasks();

    return () => {
      isCanceled = true;
    };
  }, [isLoaded, tasks]);

  function handleAddTask(projectNumber, projectName, description) {
    const createdAt = new Date();

    setTasks((currentTasks) => [
      ...currentTasks,
      {
        id: createId(),
        projectNumber,
        projectName,
        description,
        status: DEFAULT_TASK_STATUS,
        createdAt: createdAt.toISOString(),
        weekStart: getMondayWeekStartKey(createdAt),
      },
    ]);
  }

  function handleDeleteTask(taskId) {
    setTasks((currentTasks) => currentTasks.filter((task) => task.id !== taskId));
  }

  function handleUpdateTask(taskId, updates) {
    setTasks((currentTasks) =>
      currentTasks.map((task) => (task.id === taskId ? { ...task, ...updates } : task)),
    );
  }

  async function handleChooseDatabase() {
    try {
      const result = await chooseTaskDatabase();

      if (result.canceled) {
        return;
      }

      shouldSkipNextSave.current = true;
      setTasks(normalizeTasks(result.tasks));
      setDatabasePath(result.databasePath);
      setDatabaseError('');
      setSelectedProjectNumber(null);
    } catch (error) {
      setDatabaseError(getDatabaseErrorMessage(error, 'Could not open selected database'));
    }
  }

  return (
    <main className={styles.appShell}>
      <section className={styles.workspace}>
        {databaseError ? <p className={styles.databaseError}>{databaseError}</p> : null}

        {selectedProjectNumber ? (
          <ProjectTasksPage
            projectName={selectedProjectName}
            projectNumber={selectedProjectNumber}
            tasks={selectedProjectTasks}
            isLoaded={isLoaded}
            onBack={() => setSelectedProjectNumber(null)}
            onDeleteTask={handleDeleteTask}
            onUpdateTask={handleUpdateTask}
          />
        ) : (
          <>
            <TaskForm
              databasePath={databasePath}
              onAddTask={handleAddTask}
              onChooseDatabase={handleChooseDatabase}
            />
            <TaskTable
              tasks={tasks}
              isLoaded={isLoaded}
              onOpenProject={setSelectedProjectNumber}
              onDeleteTask={handleDeleteTask}
              onUpdateTask={handleUpdateTask}
              showDatabaseFooter={false}
            />
          </>
        )}
      </section>
    </main>
  );
}

export default App;
