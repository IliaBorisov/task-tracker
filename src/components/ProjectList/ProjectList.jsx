import { ArrowDown, ArrowUp, CalendarDays, ChevronDown, ChevronRight, ChevronUp, FolderOpen } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog.jsx';
import EditTaskDialog from '../EditTaskDialog/EditTaskDialog.jsx';
import TaskContextMenu from '../TaskContextMenu/TaskContextMenu.jsx';
import TaskRow from '../TaskRow/TaskRow.jsx';
import ProjectTreeNode from '../ProjectTreeNode/ProjectTreeNode.jsx';
import useTaskRowDrag from '../TaskRow/useTaskRowDrag.js';
import treeStyles from '../TaskTree/TaskTree.module.css';
import { formatWeekLabel, getMondayWeekStartKey } from '../../utils/week.js';
import { compareProjects, PROJECT_SORT_OPTIONS } from './projectSort.js';
import styles from './ProjectList.module.css';

function getCountLabel(count, singularLabel, pluralLabel) {
  return `${count} ${count === 1 ? singularLabel : pluralLabel}`;
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
        label: formatWeekLabel(getMondayWeekStartKey(weekStart)),
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

function getProjectWeekKey(projectId, weekStart) {
  return JSON.stringify([projectId, weekStart]);
}

function ProjectList({
  projects,
  tasks,
  isLoaded,
  emptyMessage = 'No projects yet',
  sortOrder = 'number-asc',
  onSortOrderChange,
  onDeleteTask,
  onOpenProject,
  onOpenProjectFolder,
  onUpdateTask,
  onReorderTask,
}) {
  const treeId = useId();
  const sortField = sortOrder.startsWith('task-count') ? 'task-count' : 'number';
  const sortDirection = sortOrder.endsWith('-desc') ? 'desc' : 'asc';
  const activeSortOrder = `${sortField}-${sortDirection}`;
  const [collapsedProjectWeeks, setCollapsedProjectWeeks] = useState(() => new Set());
  const [expandedProjectIds, setExpandedProjectIds] = useState(() => new Set());
  const [editingTask, setEditingTask] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [pendingDeleteTask, setPendingDeleteTask] = useState(null);
  const getTaskRowDragProps = useTaskRowDrag({ tasks, onReorderTask, restrictToProject: true });
  const projectTaskMap = useMemo(() => createProjectTaskMap(tasks), [tasks]);
  const projectRows = useMemo(
    () =>
      [...projects]
        .filter((project) => projectTaskMap.has(project.projectId))
        .map((project) => ({
          ...project,
          tasks: projectTaskMap.get(project.projectId),
        }))
        .sort((firstProject, secondProject) => compareProjects(firstProject, secondProject, activeSortOrder))
        .map((project, index) => ({
          ...project,
          rowNumber: index + 1,
          weekGroups: groupProjectTasksByWeek(project.tasks),
        })),
    [projectTaskMap, projects, activeSortOrder],
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

  function handleToggleWeek(projectId, weekStart) {
    const key = getProjectWeekKey(projectId, weekStart);
    setCollapsedProjectWeeks((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleToggleAllProjects() {
    if (!hasProjects) {
      return;
    }

    if (!areAllProjectsExpanded) {
      setCollapsedProjectWeeks(new Set());
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
    setCollapsedProjectWeeks((current) => {
      const next = new Set(current);
      currentWeekProjectIds.forEach((projectId) =>
        next.delete(getProjectWeekKey(projectId, currentWeekStart)),
      );
      return next;
    });
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
    const childrenId = `${treeId}-project-${project.rowNumber}`;
    const projectLabel = [project.projectNumber, project.projectName].filter(Boolean).join(' - ');

    return (
      <ProjectTreeNode
        key={project.projectId}
        className={styles.projectBranch}
        project={project}
        tasks={project.tasks}
        showStatus={false}
        isExpanded={isExpanded}
        childrenId={childrenId}
        onToggle={() => handleToggleProject(project.projectId)}
        onOpenProject={onOpenProject}
        onOpenProjectFolder={onOpenProjectFolder}
      >
        <ul id={childrenId} className={styles.weeks} aria-label={`Weeks for ${projectLabel}`}>
          {project.weekGroups.map((weekGroup, weekIndex) => {
            const weekKey = getProjectWeekKey(project.projectId, weekGroup.weekStart);
            const isWeekExpanded = !collapsedProjectWeeks.has(weekKey);
            const tasksId = `${childrenId}-week-${weekIndex}`;
            const [weekLabel, ...dateLabel] = weekGroup.label.split(',');

            return (
              <li key={weekGroup.weekStart} className={`${treeStyles.projectBranch} ${styles.weekBranch}`}>
                <div className={styles.weekGroup}>
                  <button
                    className={`${treeStyles.weekHeading} ${styles.weekHeading}`}
                    type="button"
                    onClick={() => handleToggleWeek(project.projectId, weekGroup.weekStart)}
                    aria-expanded={isWeekExpanded}
                    aria-controls={isWeekExpanded ? tasksId : undefined}
                    aria-label={`${isWeekExpanded ? 'Collapse' : 'Expand'} ${weekGroup.label} for ${projectLabel}`}
                  >
                    {isWeekExpanded ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
                    <CalendarDays size={17} aria-hidden="true" />
                    <span className={treeStyles.weekTitle}>{weekLabel}</span>
                    <span className={treeStyles.weekDate}>{dateLabel.join(',').trim()}</span>
                    {weekGroup.weekStart === currentWeekStart ? <span className={treeStyles.currentWeek}>Current week</span> : null}
                    <span className={treeStyles.weekCount}>{getCountLabel(weekGroup.tasks.length, 'task', 'tasks')}</span>
                  </button>
                  {isWeekExpanded ? (
                    <ul id={tasksId} className={`${treeStyles.tasks} ${styles.weekTasks}`} aria-label={`Tasks in ${weekGroup.label} for ${projectLabel}`}>
                      {weekGroup.tasks.map(({ task, rowNumber }) => (
                        <li key={task.id} className={treeStyles.taskBranch}>
                          <TaskRow
                            task={task}
                            layout="tree"
                            rowNumber={`${project.rowNumber}.${rowNumber}`}
                            {...getTaskRowDragProps(task)}
                            onEditTask={handleStartEdit}
                            onOpenContextMenu={handleOpenContextMenu}
                            onOpenProject={onOpenProject}
                            onOpenProjectFolder={onOpenProjectFolder}
                            onStatusChange={handleStatusChange}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </ProjectTreeNode>
    );
  }

  return (
    <>
      <section className={styles.projectPanel} aria-label="Projects">
        <div className={styles.projectToolbar}>
          <div className={styles.sortControl}>
            <span>Sort by</span>
            <div className={styles.sortTabs} role="group" aria-label="Sort projects">
              {PROJECT_SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={`${styles.sortTab} ${sortField === option.value ? styles.activeSortTab : ''}`}
                  type="button"
                  value={option.value}
                  aria-pressed={sortField === option.value}
                  onClick={() => onSortOrderChange(`${option.value}-${sortDirection}`)}
                  disabled={!isLoaded || !hasProjects}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.sortDirection} role="group" aria-label="Sort direction">
            <button
              className={`${styles.sortDirectionButton} ${sortDirection === 'asc' ? styles.activeSortDirection : ''}`}
              type="button"
              aria-label="Sort ascending"
              aria-pressed={sortDirection === 'asc'}
              title={sortField === 'number' ? 'Lowest number first' : 'Fewest tasks first'}
              disabled={!isLoaded || !hasProjects}
              onClick={() => onSortOrderChange(`${sortField}-asc`)}
            >
              <ArrowUp size={14} aria-hidden="true" />
            </button>
            <button
              className={`${styles.sortDirectionButton} ${sortDirection === 'desc' ? styles.activeSortDirection : ''}`}
              type="button"
              aria-label="Sort descending"
              aria-pressed={sortDirection === 'desc'}
              title={sortField === 'number' ? 'Highest number first' : 'Most tasks first'}
              disabled={!isLoaded || !hasProjects}
              onClick={() => onSortOrderChange(`${sortField}-desc`)}
            >
              <ArrowDown size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
        {!isLoaded || !hasProjects ? (
          <div className={treeStyles.emptyState} role="status">
            <FolderOpen size={28} strokeWidth={1.4} aria-hidden="true" />
            <p>{isLoaded ? emptyMessage : 'Loading projects'}</p>
          </div>
        ) : (
          <div className={treeStyles.treeScroll}>
            <ul className={styles.projectTree} aria-label="Projects and tasks">
              {projectRows.map(renderProjectRow)}
            </ul>
          </div>
        )}
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
