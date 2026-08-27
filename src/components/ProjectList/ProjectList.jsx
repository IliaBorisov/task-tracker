import { CalendarDays, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog.jsx';
import EditTaskDialog from '../EditTaskDialog/EditTaskDialog.jsx';
import TaskContextMenu from '../TaskContextMenu/TaskContextMenu.jsx';
import TaskRow from '../TaskRow/TaskRow.jsx';
import { formatWeekLabel, getMondayWeekStartKey } from '../../utils/week.js';
import styles from './ProjectList.module.css';

const PROJECT_COLUMNS = [
  { id: 'rowNumber', label: 'No' },
  { id: 'week', label: 'Week' },
  { id: 'projectCode', label: 'Number' },
  { id: 'projectName', label: 'Name' },
  { id: 'description', label: 'Description' },
  { id: 'dueDate', label: 'Due' },
  { id: 'status', label: 'Status' },
];

function getCountLabel(count, singularLabel, pluralLabel) {
  return `${count} ${count === 1 ? singularLabel : pluralLabel}`;
}

function getProjectLabel(project) {
  return [project.projectNumber, project.projectName].filter(Boolean).join(' - ');
}

function getTaskWeekStart(task) {
  return task.weekStart || getMondayWeekStartKey(task.createdAt);
}

function groupProjectTasksByWeek(tasks) {
  const groups = new Map();

  tasks.forEach((task) => {
    const weekStart = getTaskWeekStart(task);

    if (!groups.has(weekStart)) {
      groups.set(weekStart, {
        weekStart,
        label: formatWeekLabel(weekStart),
        tasks: [],
      });
    }

    groups.get(weekStart).tasks.push(task);
  });

  let rowNumber = 0;
  const sortedGroups = Array.from(groups.values()).sort((firstGroup, secondGroup) =>
    secondGroup.weekStart.localeCompare(firstGroup.weekStart),
  );

  return sortedGroups.map((group) => ({
    ...group,
    tasks: group.tasks.map((task) => ({
      task,
      rowNumber: (rowNumber += 1),
    })),
  }));
}

function createProjectTaskMap(tasks) {
  return (Array.isArray(tasks) ? tasks : []).reduce((projectTaskMap, task) => {
    if (!task.projectId) {
      return projectTaskMap;
    }

    if (!projectTaskMap.has(task.projectId)) {
      projectTaskMap.set(task.projectId, []);
    }

    projectTaskMap.get(task.projectId).push(task);

    return projectTaskMap;
  }, new Map());
}

function ProjectList({
  projects,
  tasks,
  isLoaded,
  emptyMessage = 'No projects yet',
  onDeleteTask,
  onOpenProject,
  onOpenProjectFolder,
  onUpdateTask,
}) {
  const [expandedProjectIds, setExpandedProjectIds] = useState(() => new Set());
  const [editingTask, setEditingTask] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [pendingDeleteTask, setPendingDeleteTask] = useState(null);
  const projectTaskMap = useMemo(() => createProjectTaskMap(tasks), [tasks]);
  const projectRows = useMemo(
    () =>
      projects.map((project, index) => {
        const projectTasks = projectTaskMap.get(project.projectId) || [];

        return {
          ...project,
          rowNumber: index + 1,
          tasks: projectTasks,
          weekGroups: groupProjectTasksByWeek(projectTasks),
        };
      }),
    [projectTaskMap, projects],
  );
  const hasProjects = projectRows.length > 0;
  const currentWeekStart = getMondayWeekStartKey();
  const hasCurrentWeekGroup = projectRows.some((project) =>
    project.weekGroups.some((weekGroup) => weekGroup.weekStart === currentWeekStart),
  );
  const areAllProjectsExpanded =
    hasProjects && projectRows.every((project) => expandedProjectIds.has(project.projectId));
  const projectToggleLabel = areAllProjectsExpanded ? 'Collapse all' : 'Expand all';
  const taskCount = projectRows.reduce(
    (currentTaskCount, project) => currentTaskCount + project.tasks.length,
    0,
  );

  function handleToggleProject(projectId) {
    setExpandedProjectIds((currentProjectIds) => {
      const nextProjectIds = new Set(currentProjectIds);

      if (nextProjectIds.has(projectId)) {
        nextProjectIds.delete(projectId);
      } else {
        nextProjectIds.add(projectId);
      }

      return nextProjectIds;
    });
  }

  function handleToggleAllProjects() {
    if (!hasProjects) {
      return;
    }

    setExpandedProjectIds(
      areAllProjectsExpanded
        ? new Set()
        : new Set(projectRows.map((project) => project.projectId)),
    );
  }

  function handleShowCurrentWeek() {
    const currentWeekProjectIds = projectRows
      .filter((project) =>
        project.weekGroups.some((weekGroup) => weekGroup.weekStart === currentWeekStart),
      )
      .map((project) => project.projectId);

    setExpandedProjectIds(new Set(currentWeekProjectIds));
  }

  function handleStartEdit(taskId) {
    const task = tasks.find((currentTask) => currentTask.id === taskId);

    setContextMenu(null);

    if (task) {
      setEditingTask(task);
    }
  }

  function handleCancelEdit() {
    setEditingTask(null);
  }

  function handleSaveEdit(taskId, updates) {
    onUpdateTask?.(taskId, updates);
    setEditingTask(null);
  }

  function handleStatusChange(taskId, status) {
    onUpdateTask?.(taskId, { status });
  }

  function handleOpenContextMenu(task, event) {
    event.preventDefault();

    setContextMenu({
      task,
      x: event.clientX,
      y: event.clientY,
    });
  }

  function handleCloseContextMenu() {
    setContextMenu(null);
  }

  function handleRequestDelete(task) {
    if (task) {
      setContextMenu(null);
      setPendingDeleteTask(task);
    }
  }

  function handleCancelDelete() {
    setPendingDeleteTask(null);
  }

  function handleConfirmDelete() {
    if (!pendingDeleteTask) {
      return;
    }

    onDeleteTask(pendingDeleteTask.id);

    if (editingTask?.id === pendingDeleteTask.id) {
      setEditingTask(null);
    }

    setPendingDeleteTask(null);
  }

  function renderProjectRow(project) {
    const isExpanded = expandedProjectIds.has(project.projectId);
    const projectLabel = getProjectLabel(project);
    const canOpenProject = Boolean(project.projectId && onOpenProject);
    const canOpenProjectFolder = Boolean(project.folderPath && onOpenProjectFolder);

    return (
      <Fragment key={project.projectId}>
        <tr className={styles.projectRow}>
          <td className={styles.projectIndexCell}>
            <button
              className={styles.expandButton}
              type="button"
              onClick={() => handleToggleProject(project.projectId)}
              aria-expanded={isExpanded}
              aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${projectLabel}`}
              title={isExpanded ? 'Collapse project' : 'Expand project'}
            >
              {isExpanded ? (
                <ChevronDown size={16} aria-hidden="true" />
              ) : (
                <ChevronRight size={16} aria-hidden="true" />
              )}
              <span>{project.rowNumber}</span>
            </button>
          </td>
          <td />
          <td>
            {canOpenProject ? (
              <button
                className={styles.projectNumberButton}
                type="button"
                onClick={() => onOpenProject(project.projectId)}
              >
                {project.projectNumber}
              </button>
            ) : (
              <span className={styles.projectNumber}>{project.projectNumber}</span>
            )}
          </td>
          <td>
            {canOpenProjectFolder ? (
              <button
                className={styles.projectNameButton}
                type="button"
                onClick={() => onOpenProjectFolder(project.folderPath)}
                title={project.folderPath}
                aria-label={`Open folder for ${project.projectName}`}
              >
                {project.projectName}
              </button>
            ) : (
              <span className={styles.projectName}>{project.projectName}</span>
            )}
          </td>
          <td className={styles.projectTaskSummary}>
            {getCountLabel(project.tasks.length, 'task', 'tasks')}
          </td>
          <td />
          <td />
        </tr>
        {isExpanded && project.tasks.length === 0 ? (
          <tr className={styles.emptyProjectTasksRow}>
            <td className={styles.emptyProjectTasksCell} colSpan={PROJECT_COLUMNS.length}>
              No tasks in this project
            </td>
          </tr>
        ) : null}
        {isExpanded
          ? project.weekGroups.map((weekGroup) => (
              <Fragment key={weekGroup.weekStart}>
                {weekGroup.tasks.map(({ task, rowNumber }) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    rowNumber={rowNumber}
                    showWeekColumn
                    isCurrentWeek={weekGroup.weekStart === currentWeekStart}
                    weekLabel={weekGroup.label}
                    onOpenContextMenu={handleOpenContextMenu}
                    onOpenProject={onOpenProject}
                    onOpenProjectFolder={onOpenProjectFolder}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </Fragment>
            ))
          : null}
      </Fragment>
    );
  }

  return (
    <>
      <section className={styles.projectPanel} aria-label="Projects">
        <div className={styles.projectTableScroll}>
          <table className={styles.projectTable}>
            <colgroup>
              <col className={styles.rowNumberColumn} />
              <col className={styles.weekColumn} />
              <col className={styles.projectCodeColumn} />
              <col className={styles.projectNameColumn} />
              <col className={styles.descriptionColumn} />
              <col className={styles.dueDateColumn} />
              <col className={styles.statusColumn} />
            </colgroup>
            <thead>
              <tr>
                {PROJECT_COLUMNS.map((column) => (
                  <th key={column.id}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!isLoaded ? (
                <tr>
                  <td className={styles.emptyState} colSpan={PROJECT_COLUMNS.length}>
                    Loading projects
                  </td>
                </tr>
              ) : projectRows.length === 0 ? (
                <tr>
                  <td className={styles.emptyState} colSpan={PROJECT_COLUMNS.length}>
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                projectRows.map(renderProjectRow)
              )}
            </tbody>
          </table>
        </div>
        <footer className={styles.projectFooter}>
          <div className={styles.projectStats}>
            <span>
              {isLoaded
                ? getCountLabel(projectRows.length, 'project', 'projects')
                : 'Loading projects'}
            </span>
            {isLoaded && hasProjects ? (
              <span>{getCountLabel(taskCount, 'task', 'tasks')}</span>
            ) : null}
          </div>
          {isLoaded && hasProjects ? (
            <div className={styles.projectActions}>
              {hasCurrentWeekGroup ? (
                <button
                  className={styles.projectToggleButton}
                  type="button"
                  onClick={handleShowCurrentWeek}
                  aria-label="Show current week projects"
                  title="Current week"
                >
                  <CalendarDays size={15} aria-hidden="true" />
                  <span>Current week</span>
                </button>
              ) : null}
              <button
                className={styles.projectToggleButton}
                type="button"
                onClick={handleToggleAllProjects}
                aria-label={`${projectToggleLabel} projects`}
                title={`${projectToggleLabel} projects`}
              >
                {areAllProjectsExpanded ? (
                  <ChevronUp size={15} aria-hidden="true" />
                ) : (
                  <ChevronDown size={15} aria-hidden="true" />
                )}
                <span>{projectToggleLabel}</span>
              </button>
            </div>
          ) : null}
        </footer>
      </section>

      {pendingDeleteTask ? (
        <ConfirmDialog
          title="Delete task?"
          description={`Delete ${pendingDeleteTask.projectNumber || 'this project'} - ${
            pendingDeleteTask.projectName
          }?`}
          onCancel={handleCancelDelete}
          onConfirm={handleConfirmDelete}
        />
      ) : null}

      {contextMenu ? (
        <TaskContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={handleCloseContextMenu}
          onDelete={() => handleRequestDelete(contextMenu.task)}
          onEdit={() => handleStartEdit(contextMenu.task.id)}
        />
      ) : null}

      {editingTask ? (
        <EditTaskDialog task={editingTask} onCancel={handleCancelEdit} onSave={handleSaveEdit} />
      ) : null}
    </>
  );
}

export default ProjectList;
