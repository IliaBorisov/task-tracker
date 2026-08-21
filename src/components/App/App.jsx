import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import KanbanBoard from '../KanbanBoard/KanbanBoard.jsx';
import ProjectTasksPage from '../ProjectTasksPage/ProjectTasksPage.jsx';
import TaskLibrary, { TASK_LIBRARY_TABS } from '../TaskLibrary/TaskLibrary.jsx';
import TaskTable from '../TaskTable/TaskTable.jsx';
import { DEFAULT_TASK_STATUS, normalizeTaskStatus } from '../../constants/taskStatus.js';
import {
  chooseTaskDatabase,
  getTaskDatabasePath,
  loadTaskDatabase,
  saveTaskDatabase,
} from '../../data/taskDatabase.js';
import { getMondayWeekStartKey } from '../../utils/week.js';
import styles from './App.module.css';

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

function normalizeTask(task) {
  const createdAt =
    typeof task.createdAt === 'string' && !Number.isNaN(Date.parse(task.createdAt))
      ? task.createdAt
      : new Date().toISOString();

  return {
    id: task.id || createId(),
    projectId:
      task.projectId === undefined || task.projectId === null ? '' : String(task.projectId),
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
    .filter((task) => task.projectId && task.description);
}

function addTaskToTasksByYear(tasksByYear, task) {
  const year = getTaskYear(task);

  return {
    ...tasksByYear,
    [year]: [...(tasksByYear[year] || []), task],
  };
}

function normalizeTasksByYear(savedTasks) {
  const tasksByYear = {};

  if (Array.isArray(savedTasks)) {
    normalizeTasks(savedTasks).forEach((task) => {
      const year = getTaskYear(task);
      tasksByYear[year] = [...(tasksByYear[year] || []), task];
    });

    return tasksByYear;
  }

  if (!savedTasks || typeof savedTasks !== 'object') {
    return tasksByYear;
  }

  Object.values(savedTasks).forEach((yearTasks) => {
    normalizeTasks(yearTasks).forEach((task) => {
      const year = getTaskYear(task);
      tasksByYear[year] = [...(tasksByYear[year] || []), task];
    });
  });

  return tasksByYear;
}

function flattenTasksByYear(tasksByYear) {
  if (!tasksByYear || typeof tasksByYear !== 'object') {
    return [];
  }

  return Object.keys(tasksByYear)
    .sort((firstYear, secondYear) => secondYear.localeCompare(firstYear))
    .flatMap((year) => (Array.isArray(tasksByYear[year]) ? tasksByYear[year] : []));
}

function getInitialActiveYear(tasksByYear) {
  const currentYear = getCurrentYearKey();
  const years = Object.keys(tasksByYear).sort((firstYear, secondYear) =>
    secondYear.localeCompare(firstYear),
  );

  return years.includes(currentYear) ? currentYear : years[0] || currentYear;
}

function getAdjacentYear(year, direction) {
  const numericYear = Number.parseInt(year, 10);

  if (Number.isNaN(numericYear)) {
    return getCurrentYearKey();
  }

  return String(numericYear + direction);
}

function updateTaskInTasksByYear(tasksByYear, taskId, createNextTask) {
  let nextTask = null;
  let didUpdate = false;
  const nextTasksByYear = {};

  Object.entries(tasksByYear).forEach(([year, yearTasks]) => {
    if (!Array.isArray(yearTasks)) {
      return;
    }

    const remainingTasks = [];

    yearTasks.forEach((task) => {
      if (task.id !== taskId) {
        remainingTasks.push(task);
        return;
      }

      didUpdate = true;
      nextTask = createNextTask(task);
    });

    if (remainingTasks.length > 0) {
      nextTasksByYear[year] = remainingTasks;
    }
  });

  if (!didUpdate) {
    return tasksByYear;
  }

  if (nextTask) {
    const nextYear = getTaskYear(nextTask);
    nextTasksByYear[nextYear] = [...(nextTasksByYear[nextYear] || []), nextTask];
  }

  return nextTasksByYear;
}

function deleteTaskFromTasksByYear(tasksByYear, taskId) {
  let didDelete = false;
  const nextTasksByYear = {};

  Object.entries(tasksByYear).forEach(([year, yearTasks]) => {
    if (!Array.isArray(yearTasks)) {
      return;
    }

    const nextYearTasks = yearTasks.filter((task) => task.id !== taskId);

    if (nextYearTasks.length !== yearTasks.length) {
      didDelete = true;
    }

    if (nextYearTasks.length > 0) {
      nextTasksByYear[year] = nextYearTasks;
    }
  });

  return didDelete ? nextTasksByYear : tasksByYear;
}

function getDatabaseErrorMessage(error, fallbackMessage) {
  if (!error?.message) {
    return fallbackMessage;
  }

  return String(error.message)
    .replace(/^Error invoking remote method '[^']+':\s*/, '')
    .replace(/^Error:\s*/, '');
}

function getTaskSearchText(task) {
  return [
    task.projectNumber,
    task.projectName,
    task.description,
    task.note,
    task.status,
    task.weekStart,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getProjectNumberKey(projectNumber) {
  return String(projectNumber || '').trim().toLowerCase();
}

function normalizeProjectRecord(projectId, projectNumber, projectName, updatedAt = '') {
  const trimmedProjectId = String(projectId || '').trim();
  const trimmedProjectNumber = String(projectNumber || '').trim();
  const trimmedProjectName = String(projectName || '').trim();

  if (!trimmedProjectId || !trimmedProjectNumber || !trimmedProjectName) {
    return null;
  }

  return {
    id: trimmedProjectId,
    projectNumber: trimmedProjectNumber,
    projectName: trimmedProjectName,
    updatedAt:
      typeof updatedAt === 'string' && !Number.isNaN(Date.parse(updatedAt)) ? updatedAt : '',
  };
}

function upsertProject(
  projects,
  projectId,
  projectNumber,
  projectName,
  updatedAt = new Date().toISOString(),
) {
  const project = normalizeProjectRecord(projectId, projectNumber, projectName, updatedAt);

  if (!project) {
    return projects;
  }

  return {
    ...projects,
    [project.id]: project,
  };
}

function normalizeProjects(savedProjects) {
  let projects = {};

  if (savedProjects && typeof savedProjects === 'object' && !Array.isArray(savedProjects)) {
    Object.entries(savedProjects).forEach(([projectId, project]) => {
      if (!project || typeof project !== 'object') {
        return;
      }

      projects = upsertProject(
        projects,
        project.id || projectId,
        project.projectNumber,
        project.projectName,
        project.updatedAt,
      );
    });
  }

  return projects;
}

function getTimeValue(value) {
  const parsedTime = Date.parse(value);

  return Number.isNaN(parsedTime) ? 0 : parsedTime;
}

function createProjectIndex(projects, tasks) {
  const projectsByNumber = new Map();
  const projectsById = new Map();

  Object.values(projects).forEach((project) => {
    const normalizedProject = normalizeProjectRecord(
      project.id,
      project.projectNumber,
      project.projectName,
      project.updatedAt,
    );

    if (!normalizedProject) {
      return;
    }

    const projectNumberKey = getProjectNumberKey(normalizedProject.projectNumber);
    const indexedProject = {
      projectId: normalizedProject.id,
      projectNumber: normalizedProject.projectNumber,
      projectNumberKey,
      projectName: normalizedProject.projectName,
      projectNames: [normalizedProject.projectName],
      taskCount: 0,
      latestTime: getTimeValue(normalizedProject.updatedAt),
    };

    projectsByNumber.set(projectNumberKey, indexedProject);
    projectsById.set(normalizedProject.id, indexedProject);
  });

  tasks.forEach((task) => {
    const project = projectsById.get(task.projectId);
    const createdTime = getTimeValue(task.createdAt);

    if (!project) {
      return;
    }

    project.taskCount += 1;
    project.latestTime = Math.max(project.latestTime, createdTime);
  });

  const suggestions = Array.from(projectsByNumber.values()).sort(
    (firstProject, secondProject) =>
      secondProject.latestTime - firstProject.latestTime ||
      firstProject.projectNumber.localeCompare(secondProject.projectNumber),
  );

  return {
    lookup: new Map(suggestions.map((project) => [project.projectNumberKey, project])),
    byId: new Map(suggestions.map((project) => [project.projectId, project])),
    suggestions,
  };
}

function hydrateTasks(tasks, projects) {
  return tasks.map((task) => {
    const project = projects[task.projectId];

    return {
      ...task,
      projectNumber: project?.projectNumber || '',
      projectName: project?.projectName || '',
    };
  });
}

const TASK_VIEW = {
  TABLE: 'table',
  KANBAN: 'kanban',
};

function App() {
  const shouldSkipNextSave = useRef(true);
  const [tasksByYear, setTasksByYear] = useState({});
  const [activeYear, setActiveYear] = useState(getCurrentYearKey);
  const [projects, setProjects] = useState({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [databasePath, setDatabasePath] = useState('');
  const [databaseError, setDatabaseError] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [activeLibraryTab, setActiveLibraryTab] = useState(TASK_LIBRARY_TABS.ADD);
  const [activeTaskView, setActiveTaskView] = useState(TASK_VIEW.TABLE);
  const [searchQuery, setSearchQuery] = useState('');
  const allTasks = useMemo(() => flattenTasksByYear(tasksByYear), [tasksByYear]);
  const activeYearTasks = tasksByYear[activeYear] || [];
  const normalizedProjects = useMemo(() => normalizeProjects(projects), [projects]);
  const projectIndex = useMemo(
    () => createProjectIndex(normalizedProjects, allTasks),
    [allTasks, normalizedProjects],
  );
  const allTaskViews = useMemo(
    () => hydrateTasks(allTasks, normalizedProjects),
    [allTasks, normalizedProjects],
  );
  const taskViews = useMemo(
    () => hydrateTasks(activeYearTasks, normalizedProjects),
    [activeYearTasks, normalizedProjects],
  );
  const searchTokens = useMemo(
    () => searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [searchQuery],
  );
  const searchResultTasks = useMemo(() => {
    if (searchTokens.length === 0) {
      return taskViews;
    }

    return taskViews.filter((task) => {
      const searchText = getTaskSearchText(task);

      return searchTokens.every((token) => searchText.includes(token));
    });
  }, [searchTokens, taskViews]);
  const displayedTasks =
    activeLibraryTab === TASK_LIBRARY_TABS.SEARCH ? searchResultTasks : taskViews;
  const isSearching =
    activeLibraryTab === TASK_LIBRARY_TABS.SEARCH && searchTokens.length > 0;
  const isKanbanView = activeTaskView === TASK_VIEW.KANBAN;
  const selectedProject = selectedProjectId ? normalizedProjects[selectedProjectId] : null;
  const selectedProjectTasks = useMemo(
    () =>
      selectedProjectId
        ? allTaskViews.filter((task) => task.projectId === selectedProjectId)
        : [],
    [allTaskViews, selectedProjectId],
  );
  const selectedProjectName =
    selectedProject?.projectName ||
    selectedProjectTasks.find((task) => task.projectName)?.projectName ||
    '';

  useEffect(() => {
    let isCanceled = false;

    async function initializeTasks() {
      try {
        const [savedDatabase, savedDatabasePath] = await Promise.all([
          loadTaskDatabase(),
          getTaskDatabasePath(),
        ]);
        const normalizedTasksByYear = normalizeTasksByYear(savedDatabase.tasks);
        const loadedProjects = normalizeProjects(savedDatabase.projects);

        if (!isCanceled) {
          shouldSkipNextSave.current = true;
          setTasksByYear(normalizedTasksByYear);
          setActiveYear(getInitialActiveYear(normalizedTasksByYear));
          setProjects(loadedProjects);
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
        await saveTaskDatabase({
          projects: normalizedProjects,
          tasks: tasksByYear,
        });

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
  }, [isLoaded, normalizedProjects, tasksByYear]);

  function handleAddTask(projectNumber, projectName, description) {
    const createdAt = new Date();
    const createdAtIso = createdAt.toISOString();
    const trimmedProjectNumber = String(projectNumber || '').trim();
    const trimmedProjectName = String(projectName || '').trim();
    const existingProject = projectIndex.lookup.get(getProjectNumberKey(trimmedProjectNumber));
    const projectId = existingProject?.projectId || createId();

    setProjects((currentProjects) =>
      upsertProject(
        currentProjects,
        projectId,
        trimmedProjectNumber,
        trimmedProjectName,
        createdAtIso,
      ),
    );

    const nextTask = {
      id: createId(),
      projectId,
      description,
      note: '',
      status: DEFAULT_TASK_STATUS,
      createdAt: createdAtIso,
      weekStart: getMondayWeekStartKey(createdAt),
    };

    setActiveYear(getTaskYear(nextTask));
    setTasksByYear((currentTasksByYear) => addTaskToTasksByYear(currentTasksByYear, nextTask));
  }

  function handleDeleteTask(taskId) {
    setTasksByYear((currentTasksByYear) =>
      deleteTaskFromTasksByYear(currentTasksByYear, taskId),
    );
  }

  function handleUpdateTask(taskId, updates) {
    const currentTask = allTasks.find((task) => task.id === taskId);
    const currentProject = currentTask ? normalizedProjects[currentTask.projectId] : null;
    const hasProjectUpdates =
      Object.prototype.hasOwnProperty.call(updates, 'projectNumber') ||
      Object.prototype.hasOwnProperty.call(updates, 'projectName');
    let nextProjectId = currentTask?.projectId || '';

    if (currentTask && hasProjectUpdates) {
      const nextProjectNumber =
        updates.projectNumber === undefined
          ? currentProject?.projectNumber || ''
          : updates.projectNumber;
      const nextProjectName =
        updates.projectName === undefined
          ? currentProject?.projectName || ''
          : updates.projectName;
      const trimmedProjectNumber = String(nextProjectNumber || '').trim();
      const trimmedProjectName = String(nextProjectName || '').trim();
      const currentProjectNumberKey = getProjectNumberKey(currentProject?.projectNumber);
      const nextProjectNumberKey = getProjectNumberKey(trimmedProjectNumber);
      const existingProject = projectIndex.lookup.get(getProjectNumberKey(trimmedProjectNumber));

      if (existingProject) {
        nextProjectId = existingProject.projectId;

        if (existingProject.projectId === currentTask.projectId) {
          setProjects((currentProjects) =>
            upsertProject(
              currentProjects,
              nextProjectId,
              trimmedProjectNumber,
              trimmedProjectName,
            ),
          );
        }
      } else {
        nextProjectId =
          nextProjectNumberKey === currentProjectNumberKey ? currentTask.projectId : createId();

        setProjects((currentProjects) =>
          upsertProject(
            currentProjects,
            nextProjectId,
            trimmedProjectNumber,
            trimmedProjectName,
          ),
        );
      }
    }

    setTasksByYear((currentTasksByYear) =>
      updateTaskInTasksByYear(currentTasksByYear, taskId, (task) => {
        const nextTask = {
          ...task,
          ...updates,
          projectId: nextProjectId,
        };

        delete nextTask.projectNumber;
        delete nextTask.projectName;

        return nextTask;
      }),
    );
  }

  function handleUpdateProject(nextProjectNumber, nextProjectName) {
    if (!selectedProjectId) {
      return false;
    }

    const nextProjectNumberKey = getProjectNumberKey(nextProjectNumber);
    const trimmedProjectNumber = String(nextProjectNumber || '').trim();
    const trimmedProjectName = String(nextProjectName || '').trim();
    const existingProject = projectIndex.lookup.get(nextProjectNumberKey);

    if (!trimmedProjectNumber || !trimmedProjectName) {
      return false;
    }

    if (existingProject && existingProject.projectId !== selectedProjectId) {
      return false;
    }

    const updatedAt = new Date().toISOString();

    setProjects((currentProjects) =>
      upsertProject(
        currentProjects,
        selectedProjectId,
        trimmedProjectNumber,
        trimmedProjectName,
        updatedAt,
      ),
    );

    return true;
  }

  async function handleChooseDatabase() {
    try {
      const result = await chooseTaskDatabase();

      if (result.canceled) {
        return;
      }

      const normalizedTasksByYear = normalizeTasksByYear(result.tasks);
      const loadedProjects = normalizeProjects(result.projects);
      shouldSkipNextSave.current = true;
      setTasksByYear(normalizedTasksByYear);
      setActiveYear(getInitialActiveYear(normalizedTasksByYear));
      setProjects(loadedProjects);
      setDatabasePath(result.databasePath);
      setDatabaseError('');
      setSelectedProjectId(null);
    } catch (error) {
      setDatabaseError(getDatabaseErrorMessage(error, 'Could not open selected database'));
    }
  }

  function handlePreviousYear() {
    setActiveYear((currentYear) => getAdjacentYear(currentYear, -1));
  }

  function handleNextYear() {
    setActiveYear((currentYear) => getAdjacentYear(currentYear, 1));
  }

  return (
    <main className={styles.appShell}>
      <section className={styles.workspace}>
        {databaseError ? <p className={styles.databaseError}>{databaseError}</p> : null}

        {selectedProjectId ? (
          <ProjectTasksPage
            projectName={selectedProjectName}
            projectNumber={selectedProject?.projectNumber || ''}
            projectId={selectedProjectId}
            tasks={selectedProjectTasks}
            isLoaded={isLoaded}
            onBack={() => setSelectedProjectId(null)}
            onDeleteTask={handleDeleteTask}
            onUpdateProject={handleUpdateProject}
            onUpdateTask={handleUpdateTask}
            projectLookup={projectIndex.lookup}
          />
        ) : (
          <div className={styles.taskListView}>
            <TaskLibrary
              activeTab={activeLibraryTab}
              databasePath={databasePath}
              onActiveTabChange={setActiveLibraryTab}
              onAddTask={handleAddTask}
              onChooseDatabase={handleChooseDatabase}
              projectLookup={projectIndex.lookup}
              projectSuggestions={projectIndex.suggestions}
              onSearchQueryChange={setSearchQuery}
              searchQuery={searchQuery}
              searchResultCount={searchResultTasks.length}
              totalTaskCount={activeYearTasks.length}
            />
            <div
              className={`${styles.taskViewToolbar} ${
                isKanbanView ? styles.kanbanTaskViewToolbar : styles.tableTaskViewToolbar
              }`}
            >
              <div
                className={`${styles.taskViewTabs} ${
                  isKanbanView ? styles.kanbanTaskViewTabs : styles.tableTaskViewTabs
                }`}
                role="tablist"
                aria-label="Task view"
              >
                <button
                  className={`${styles.taskViewTab} ${
                    isKanbanView ? '' : styles.activeTaskViewTab
                  }`}
                  type="button"
                  role="tab"
                  aria-selected={!isKanbanView}
                  onClick={() => setActiveTaskView(TASK_VIEW.TABLE)}
                >
                  Table
                </button>
                <button
                  className={`${styles.taskViewTab} ${
                    isKanbanView ? styles.activeTaskViewTab : ''
                  }`}
                  type="button"
                  role="tab"
                  aria-selected={isKanbanView}
                  onClick={() => setActiveTaskView(TASK_VIEW.KANBAN)}
                >
                  Kanban
                </button>
              </div>
              <div className={styles.yearSwitcher} aria-label="Task year">
                <button
                  type="button"
                  onClick={handlePreviousYear}
                  aria-label="Previous year"
                  title="Previous year"
                >
                  <ChevronLeft size={17} aria-hidden="true" />
                </button>
                <span>{activeYear}</span>
                <button
                  type="button"
                  onClick={handleNextYear}
                  aria-label="Next year"
                  title="Next year"
                >
                  <ChevronRight size={17} aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className={styles.taskViewContent}>
              {isKanbanView ? (
                <KanbanBoard
                  tasks={displayedTasks}
                  isLoaded={isLoaded}
                  emptyMessage={isSearching ? 'No matching tasks' : 'No tasks yet'}
                  onOpenProject={setSelectedProjectId}
                  onDeleteTask={handleDeleteTask}
                  onUpdateTask={handleUpdateTask}
                  boardLabel={isSearching ? 'Search results Kanban board' : 'Kanban board'}
                />
              ) : (
                <TaskTable
                  tasks={displayedTasks}
                  isLoaded={isLoaded}
                  emptyMessage={isSearching ? 'No matching tasks' : 'No tasks yet'}
                  onOpenProject={setSelectedProjectId}
                  onDeleteTask={handleDeleteTask}
                  onUpdateTask={handleUpdateTask}
                  showDatabaseFooter={false}
                  tableLabel={isSearching ? 'Search results task table' : 'Task table'}
                />
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
