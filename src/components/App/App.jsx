import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import KanbanBoard from '../KanbanBoard/KanbanBoard.jsx';
import ProjectList from '../ProjectList/ProjectList.jsx';
import ProjectTasksPage from '../ProjectTasksPage/ProjectTasksPage.jsx';
import TaskLibrary, { TASK_LIBRARY_TABS } from '../TaskLibrary/TaskLibrary.jsx';
import TaskTable from '../TaskTable/TaskTable.jsx';
import { DEFAULT_TASK_STATUS, normalizeTaskStatus } from '../../constants/taskStatus.js';
import {
  chooseTaskDatabase,
  chooseProjectFolder,
  getTaskDatabasePath,
  getStoredAppSettings,
  loadAppSettings,
  loadTaskDatabase,
  openProjectFolder,
  saveAppSettings,
  saveTaskDatabase,
} from '../../data/taskDatabase.js';
import {
  getMondayWeekStartKey,
  normalizeDateKey,
} from '../../utils/week.js';
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

function getTaskWeekStart(task) {
  return task?.weekStart || getMondayWeekStartKey(task?.createdAt);
}

function normalizeTask(task) {
  const createdAt =
    typeof task.createdAt === 'string' && !Number.isNaN(Date.parse(task.createdAt))
      ? task.createdAt
      : new Date().toISOString();
  const weekStart = task.weekStart || getMondayWeekStartKey(createdAt);

  return {
    id: task.id || createId(),
    projectId:
      task.projectId === undefined || task.projectId === null ? '' : String(task.projectId),
    description: task.description || '',
    note: task.note === undefined || task.note === null ? '' : String(task.note),
    status: normalizeTaskStatus(task.status),
    createdAt,
    weekStart,
    dueDate: normalizeDateKey(task.dueDate),
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
  let source = null;

  Object.entries(tasksByYear).some(([year, yearTasks]) => {
    if (!Array.isArray(yearTasks)) {
      return false;
    }

    const taskIndex = yearTasks.findIndex((task) => task.id === taskId);

    if (taskIndex === -1) {
      return false;
    }

    source = {
      year,
      taskIndex,
      nextTask: createNextTask(yearTasks[taskIndex]),
    };

    return true;
  });

  if (!source) {
    return tasksByYear;
  }

  const nextYear = source.nextTask ? getTaskYear(source.nextTask) : '';
  const nextTasksByYear = {};

  Object.entries(tasksByYear).forEach(([year, yearTasks]) => {
    if (!Array.isArray(yearTasks)) {
      return;
    }

    if (year !== source.year) {
      if (yearTasks.length > 0) {
        nextTasksByYear[year] = yearTasks;
      }

      return;
    }

    if (!source.nextTask) {
      const nextYearTasks = yearTasks.filter((_, taskIndex) => taskIndex !== source.taskIndex);

      if (nextYearTasks.length > 0) {
        nextTasksByYear[year] = nextYearTasks;
      }

      return;
    }

    if (nextYear === source.year) {
      const nextYearTasks = [...yearTasks];
      nextYearTasks[source.taskIndex] = source.nextTask;

      if (nextYearTasks.length > 0) {
        nextTasksByYear[year] = nextYearTasks;
      }

      return;
    }

    const nextYearTasks = yearTasks.filter((_, taskIndex) => taskIndex !== source.taskIndex);

    if (nextYearTasks.length > 0) {
      nextTasksByYear[year] = nextYearTasks;
    }
  });

  if (source.nextTask && nextYear !== source.year) {
    nextTasksByYear[nextYear] = [...(nextTasksByYear[nextYear] || []), source.nextTask];
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

function findLastTaskIndex(tasks, predicate) {
  for (let index = tasks.length - 1; index >= 0; index -= 1) {
    if (predicate(tasks[index])) {
      return index;
    }
  }

  return -1;
}

function reorderTaskInTasksByYear(tasksByYear, taskId, reorderOptions = {}) {
  const normalizedTaskId = String(taskId || '');
  let source = null;

  Object.entries(tasksByYear).some(([year, yearTasks]) => {
    if (!Array.isArray(yearTasks)) {
      return false;
    }

    const taskIndex = yearTasks.findIndex((task) => task.id === normalizedTaskId);

    if (taskIndex === -1) {
      return false;
    }

    source = {
      year,
      taskIndex,
      task: yearTasks[taskIndex],
    };

    return true;
  });

  if (!source) {
    return tasksByYear;
  }

  const weekStart = reorderOptions.weekStart || getTaskWeekStart(source.task);

  if (getTaskWeekStart(source.task) !== weekStart) {
    return tasksByYear;
  }

  const nextStatus =
    reorderOptions.status === undefined ? null : normalizeTaskStatus(reorderOptions.status);
  const targetTaskId = String(reorderOptions.targetTaskId || '');
  const position = reorderOptions.position === 'after' ? 'after' : 'before';
  const yearTasks = tasksByYear[source.year] || [];
  const targetTask = targetTaskId
    ? yearTasks.find((task) => task.id === targetTaskId)
    : null;

  if (targetTaskId && !targetTask) {
    return tasksByYear;
  }

  if (targetTask && getTaskWeekStart(targetTask) !== weekStart) {
    return tasksByYear;
  }

  if (targetTask && nextStatus && normalizeTaskStatus(targetTask.status) !== nextStatus) {
    return tasksByYear;
  }

  const nextTask = nextStatus ? { ...source.task, status: nextStatus } : source.task;
  const remainingTasks = yearTasks.filter((task) => task.id !== normalizedTaskId);
  let insertionIndex = -1;

  if (targetTaskId) {
    const targetIndex = remainingTasks.findIndex((task) => task.id === targetTaskId);

    if (targetIndex === -1) {
      return tasksByYear;
    }

    insertionIndex = targetIndex + (position === 'after' ? 1 : 0);
  } else {
    const lastMatchingGroupIndex = findLastTaskIndex(remainingTasks, (task) => {
      return (
        getTaskWeekStart(task) === weekStart &&
        (!nextStatus || normalizeTaskStatus(task.status) === nextStatus)
      );
    });

    if (lastMatchingGroupIndex >= 0) {
      insertionIndex = lastMatchingGroupIndex + 1;
    } else {
      const lastMatchingWeekIndex = findLastTaskIndex(
        remainingTasks,
        (task) => getTaskWeekStart(task) === weekStart,
      );

      insertionIndex =
        lastMatchingWeekIndex >= 0
          ? lastMatchingWeekIndex + 1
          : Math.min(source.taskIndex, remainingTasks.length);
    }
  }

  const nextYearTasks = [
    ...remainingTasks.slice(0, insertionIndex),
    nextTask,
    ...remainingTasks.slice(insertionIndex),
  ];
  const isSameOrder =
    nextYearTasks.length === yearTasks.length &&
    nextYearTasks.every((task, index) => task === yearTasks[index]);

  if (isSameOrder) {
    return tasksByYear;
  }

  return {
    ...tasksByYear,
    [source.year]: nextYearTasks,
  };
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
    task.dueDate,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getProjectNumberKey(projectNumber) {
  return String(projectNumber || '').trim().toLowerCase();
}

function normalizeFolderPath(folderPath) {
  return typeof folderPath === 'string' ? folderPath.trim() : '';
}

function normalizeProjectRecord(
  projectId,
  projectNumber,
  projectName,
  updatedAt = '',
  folderPath = '',
) {
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
    folderPath: normalizeFolderPath(folderPath),
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
  folderPath = projects?.[projectId]?.folderPath || '',
) {
  const project = normalizeProjectRecord(
    projectId,
    projectNumber,
    projectName,
    updatedAt,
    folderPath,
  );

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
        project.folderPath,
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
      project.folderPath,
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
      folderPath: normalizedProject.folderPath,
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
      folderPath: project?.folderPath || '',
    };
  });
}

const PROJECT_LIST_SORTER = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

function compareProjectsByNumberThenName(firstProject, secondProject) {
  return (
    PROJECT_LIST_SORTER.compare(firstProject.projectNumber, secondProject.projectNumber) ||
    PROJECT_LIST_SORTER.compare(firstProject.projectName, secondProject.projectName)
  );
}

function filterProjectsForTasks(projects, tasks) {
  const taskProjectIds = new Set(tasks.map((task) => task.projectId).filter(Boolean));

  return projects
    .filter((project) => taskProjectIds.has(project.projectId))
    .sort(compareProjectsByNumberThenName);
}

const TASK_VIEW = {
  TABLE: 'table',
  KANBAN: 'kanban',
  PROJECTS: 'projects',
};

function normalizeTaskView(taskView) {
  return taskView === TASK_VIEW.KANBAN ? TASK_VIEW.KANBAN : TASK_VIEW.TABLE;
}

function getInitialTaskView() {
  return normalizeTaskView(getStoredAppSettings().defaultTaskView);
}

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
  const [activeTaskView, setActiveTaskView] = useState(getInitialTaskView);
  const [defaultTaskView, setDefaultTaskView] = useState(getInitialTaskView);
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
  const displayedProjects = useMemo(
    () => filterProjectsForTasks(projectIndex.suggestions, displayedTasks),
    [displayedTasks, projectIndex.suggestions],
  );
  const isSearching =
    activeLibraryTab === TASK_LIBRARY_TABS.SEARCH && searchTokens.length > 0;
  const isKanbanView = activeTaskView === TASK_VIEW.KANBAN;
  const isProjectsView = activeTaskView === TASK_VIEW.PROJECTS;
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
  const selectedProjectFolderPath = selectedProject?.folderPath || '';

  useEffect(() => {
    let isCanceled = false;

    async function initializeTasks() {
      try {
        const [savedDatabase, savedDatabasePath, savedSettings] = await Promise.all([
          loadTaskDatabase(),
          getTaskDatabasePath(),
          loadAppSettings(),
        ]);
        const normalizedTasksByYear = normalizeTasksByYear(savedDatabase.tasks);
        const loadedProjects = normalizeProjects(savedDatabase.projects);
        const normalizedDefaultTaskView = normalizeTaskView(savedSettings.defaultTaskView);

        if (!isCanceled) {
          shouldSkipNextSave.current = false;
          setTasksByYear(normalizedTasksByYear);
          setActiveYear(getInitialActiveYear(normalizedTasksByYear));
          setProjects(loadedProjects);
          setDatabasePath(savedDatabasePath);
          setDefaultTaskView(normalizedDefaultTaskView);
          setActiveTaskView(normalizedDefaultTaskView);
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

  function handleAddTask(projectNumber, projectName, description, dueDate = '') {
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
      dueDate: normalizeDateKey(dueDate),
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

  function handleReorderTask(reorderOptions) {
    setTasksByYear((currentTasksByYear) =>
      reorderTaskInTasksByYear(
        currentTasksByYear,
        reorderOptions?.taskId,
        reorderOptions,
      ),
    );
  }

  async function handleDefaultTaskViewChange(nextTaskView) {
    const normalizedTaskView = normalizeTaskView(nextTaskView);

    setDefaultTaskView(normalizedTaskView);
    setActiveTaskView(normalizedTaskView);

    try {
      await saveAppSettings({ defaultTaskView: normalizedTaskView });
      setDatabaseError('');
    } catch (error) {
      setDatabaseError(getDatabaseErrorMessage(error, 'Could not save settings'));
    }
  }

  function handleUpdateProject(nextProjectNumber, nextProjectName, nextFolderPath = '') {
    if (!selectedProjectId) {
      return false;
    }

    const nextProjectNumberKey = getProjectNumberKey(nextProjectNumber);
    const trimmedProjectNumber = String(nextProjectNumber || '').trim();
    const trimmedProjectName = String(nextProjectName || '').trim();
    const trimmedFolderPath = normalizeFolderPath(nextFolderPath);
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
        trimmedFolderPath,
      ),
    );

    return true;
  }

  async function handleChooseProjectFolder(currentFolderPath = '') {
    try {
      const result = await chooseProjectFolder(currentFolderPath);

      if (result.canceled) {
        return null;
      }

      setDatabaseError('');
      return result.folderPath || '';
    } catch (error) {
      setDatabaseError(getDatabaseErrorMessage(error, 'Could not choose project folder'));
      return null;
    }
  }

  async function handleOpenProjectFolder(folderPath) {
    try {
      const result = await openProjectFolder(folderPath);

      if (result?.ok === false) {
        setDatabaseError(result.error || 'Could not open project folder');
        return false;
      }

      setDatabaseError('');
      return true;
    } catch (error) {
      setDatabaseError(getDatabaseErrorMessage(error, 'Could not open project folder'));
      return false;
    }
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
            folderPath={selectedProjectFolderPath}
            projectId={selectedProjectId}
            tasks={selectedProjectTasks}
            isLoaded={isLoaded}
            onBack={() => setSelectedProjectId(null)}
            onDeleteTask={handleDeleteTask}
            onChooseProjectFolder={handleChooseProjectFolder}
            onOpenProjectFolder={handleOpenProjectFolder}
            onUpdateProject={handleUpdateProject}
            onUpdateTask={handleUpdateTask}
            onReorderTask={handleReorderTask}
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
              defaultTaskView={defaultTaskView}
              onDefaultTaskViewChange={handleDefaultTaskViewChange}
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
                    activeTaskView === TASK_VIEW.TABLE ? styles.activeTaskViewTab : ''
                  }`}
                  type="button"
                  role="tab"
                  aria-selected={activeTaskView === TASK_VIEW.TABLE}
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
                <button
                  className={`${styles.taskViewTab} ${
                    isProjectsView ? styles.activeTaskViewTab : ''
                  }`}
                  type="button"
                  role="tab"
                  aria-selected={isProjectsView}
                  onClick={() => setActiveTaskView(TASK_VIEW.PROJECTS)}
                >
                  Projects
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
              {isProjectsView ? (
                <ProjectList
                  projects={displayedProjects}
                  tasks={displayedTasks}
                  isLoaded={isLoaded}
                  emptyMessage={isSearching ? 'No matching projects' : 'No projects this year'}
                  onOpenProject={setSelectedProjectId}
                  onOpenProjectFolder={handleOpenProjectFolder}
                  onDeleteTask={handleDeleteTask}
                  onUpdateTask={handleUpdateTask}
                />
              ) : isKanbanView ? (
                <KanbanBoard
                  tasks={displayedTasks}
                  isLoaded={isLoaded}
                  emptyMessage={isSearching ? 'No matching tasks' : 'No tasks yet'}
                  onOpenProject={setSelectedProjectId}
                  onOpenProjectFolder={handleOpenProjectFolder}
                  onDeleteTask={handleDeleteTask}
                  onUpdateTask={handleUpdateTask}
                  onReorderTask={isSearching ? undefined : handleReorderTask}
                  boardLabel={isSearching ? 'Search results Kanban board' : 'Kanban board'}
                />
              ) : (
                <TaskTable
                  tasks={displayedTasks}
                  isLoaded={isLoaded}
                  emptyMessage={isSearching ? 'No matching tasks' : 'No tasks yet'}
                  onOpenProject={setSelectedProjectId}
                  onOpenProjectFolder={handleOpenProjectFolder}
                  onDeleteTask={handleDeleteTask}
                  onUpdateTask={handleUpdateTask}
                  onReorderTask={isSearching ? undefined : handleReorderTask}
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
