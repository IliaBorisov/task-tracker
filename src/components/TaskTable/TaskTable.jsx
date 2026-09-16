import { CalendarDays, ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog.jsx';
import EditTaskDialog from '../EditTaskDialog/EditTaskDialog.jsx';
import TaskContextMenu from '../TaskContextMenu/TaskContextMenu.jsx';
import TaskRow from '../TaskRow/TaskRow.jsx';
import TaskTree from '../TaskTree/TaskTree.jsx';
import useTaskRowDrag from '../TaskRow/useTaskRowDrag.js';
import { formatWeekLabel, getMondayWeekStartKey } from '../../utils/week.js';
import styles from './TaskTable.module.css';

function getTaskWeekStart(task) {
  return task.weekStart || getMondayWeekStartKey(task.createdAt);
}

function groupTasksByProject(taskEntries) {
  const projects = new Map();

  taskEntries.forEach(({ task }) => {
    if (!projects.has(task.projectId)) {
      projects.set(task.projectId, {
        projectId: task.projectId,
        projectNumber: task.projectNumber,
        projectName: task.projectName,
        folderPath: task.folderPath,
        tasks: [],
      });
    }

    const project = projects.get(task.projectId);
    project.tasks.push({ task, rowNumber: project.tasks.length + 1 });
  });

  return Array.from(projects.values());
}

function getProjectGroupKey(weekStart, projectId) {
  return JSON.stringify([weekStart, projectId]);
}

function groupTasksByWeek(tasks) {
  const groups = new Map();

  tasks.forEach((task, originalIndex) => {
    const weekStart = getTaskWeekStart(task);

    if (!groups.has(weekStart)) {
      groups.set(weekStart, {
        weekStart,
        tasks: [],
      });
    }

    groups.get(weekStart).tasks.push({
      task,
      originalIndex,
    });
  });

  const sortedGroups = Array.from(groups.values()).sort((firstGroup, secondGroup) =>
    secondGroup.weekStart.localeCompare(firstGroup.weekStart),
  );

  return sortedGroups.map((group) => ({
    ...group,
    label: formatWeekLabel(group.weekStart),
    projects: groupTasksByProject(group.tasks),
    tasks: group.tasks.map((entry, index) => ({
      ...entry,
      rowNumber: index + 1,
    })),
  }));
}

function getCollapsedWeekStartsExceptCurrentWeek(weekGroups) {
  const currentWeekStart = getMondayWeekStartKey();

  if (!weekGroups.some((group) => group.weekStart === currentWeekStart)) {
    return null;
  }

  return new Set(
    weekGroups
      .filter((group) => group.weekStart !== currentWeekStart)
      .map((group) => group.weekStart),
  );
}

function TaskTable({
  tasks,
  isLoaded,
  databasePath,
  onOpenProject,
  onOpenProjectFolder,
  onChooseDatabase,
  onDeleteTask,
  onUpdateTask,
  onReorderTask,
  onReorderProject,
  groupByProject = false,
  defaultCollapseToCurrentWeek = true,
  emptyMessage = 'No tasks yet',
  showDatabaseFooter = true,
  tableLabel = 'Task table',
}) {
  const didApplyDefaultWeekCollapseRef = useRef(false);
  const [editingTask, setEditingTask] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [pendingDeleteTask, setPendingDeleteTask] = useState(null);
  const getTaskRowDragProps = useTaskRowDrag({
    tasks,
    onReorderTask,
    restrictToProject: groupByProject,
  });
  const [collapsedWeekStarts, setCollapsedWeekStarts] = useState(() => new Set());
  const [collapsedProjectGroups, setCollapsedProjectGroups] = useState(() => new Set());
  const groupedTasks = useMemo(() => groupTasksByWeek(tasks), [tasks]);
  const projectDragRows = useMemo(
    () => groupedTasks.flatMap((group) => group.projects.map((project) => ({
      ...project,
      id: getProjectGroupKey(group.weekStart, project.projectId),
      weekStart: group.weekStart,
    }))),
    [groupedTasks],
  );
  const getProjectDragProps = useTaskRowDrag({
    tasks: projectDragRows,
    onReorderTask: onReorderProject ? ({ taskId, targetTaskId, weekStart, position }) => {
      const source = projectDragRows.find((row) => row.id === taskId);
      const target = projectDragRows.find((row) => row.id === targetTaskId);
      if (source && target) {
        onReorderProject({ projectId: source.projectId, targetProjectId: target.projectId, weekStart, position });
      }
    } : undefined,
  });
  const taskCountLabel = `${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`;
  const weekCountLabel = `${groupedTasks.length} ${
    groupedTasks.length === 1 ? 'week' : 'weeks'
  }`;
  const hasWeekGroups = groupedTasks.length > 0;
  const currentWeekStart = getMondayWeekStartKey();
  const hasCurrentWeekGroup = groupedTasks.some((group) => group.weekStart === currentWeekStart);
  const areAllWeeksCollapsed =
    hasWeekGroups && groupedTasks.every((group) => collapsedWeekStarts.has(group.weekStart));
  const weekToggleLabel = areAllWeeksCollapsed ? 'Expand all' : 'Collapse all';

  useEffect(() => {
    if (!defaultCollapseToCurrentWeek || !isLoaded || didApplyDefaultWeekCollapseRef.current) {
      return;
    }

    const nextCollapsedWeekStarts = getCollapsedWeekStartsExceptCurrentWeek(groupedTasks);

    if (!nextCollapsedWeekStarts) {
      return;
    }

    didApplyDefaultWeekCollapseRef.current = true;
    setCollapsedWeekStarts(nextCollapsedWeekStarts);
  }, [defaultCollapseToCurrentWeek, groupedTasks, isLoaded]);

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
    onUpdateTask(taskId, updates);
    setEditingTask(null);
  }

  function handleStatusChange(taskId, status) {
    onUpdateTask(taskId, { status });
  }

  function handleToggleWeekGroup(weekStart) {
    setCollapsedWeekStarts((currentCollapsedWeekStarts) => {
      const nextCollapsedWeekStarts = new Set(currentCollapsedWeekStarts);

      if (nextCollapsedWeekStarts.has(weekStart)) {
        nextCollapsedWeekStarts.delete(weekStart);
      } else {
        nextCollapsedWeekStarts.add(weekStart);
      }

      return nextCollapsedWeekStarts;
    });
  }

  function handleToggleProjectGroup(groupKey) {
    setCollapsedProjectGroups((currentGroups) => {
      const nextGroups = new Set(currentGroups);

      if (nextGroups.has(groupKey)) {
        nextGroups.delete(groupKey);
      } else {
        nextGroups.add(groupKey);
      }

      return nextGroups;
    });
  }

  function handleToggleAllWeekGroups() {
    if (!hasWeekGroups) {
      return;
    }

    setCollapsedWeekStarts(
      areAllWeeksCollapsed ? new Set() : new Set(groupedTasks.map((group) => group.weekStart)),
    );

    if (areAllWeeksCollapsed) {
      setCollapsedProjectGroups(new Set());
    }
  }

  function handleCollapseToCurrentWeek() {
    const nextCollapsedWeekStarts = getCollapsedWeekStartsExceptCurrentWeek(groupedTasks);

    if (!nextCollapsedWeekStarts) {
      return;
    }

    setCollapsedWeekStarts(nextCollapsedWeekStarts);
    const currentWeekGroup = groupedTasks.find((group) => group.weekStart === currentWeekStart);
    setCollapsedProjectGroups((currentGroups) => {
      const nextGroups = new Set(currentGroups);
      currentWeekGroup.projects.forEach((project) =>
        nextGroups.delete(getProjectGroupKey(currentWeekStart, project.projectId)),
      );
      return nextGroups;
    });
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

  function renderTaskRow({ task, rowNumber }, projectRowNumber = null) {
    const isNested = projectRowNumber !== null;

    return (
      <TaskRow
        key={task.id}
        task={task}
        layout="tree"
        onEditTask={handleStartEdit}
        rowNumber={isNested ? `${projectRowNumber}.${rowNumber}` : rowNumber}
        isNested={isNested}
        hideProjectDetails={isNested}
        {...getTaskRowDragProps(task)}
        onOpenContextMenu={handleOpenContextMenu}
        onOpenProject={onOpenProject}
        onOpenProjectFolder={onOpenProjectFolder}
        onStatusChange={handleStatusChange}
      />
    );
  }

  return (
    <>
      <section className={`${styles.tablePanel} ${styles.treePanel}`} aria-label={tableLabel}>
        <TaskTree
          groups={groupedTasks}
          groupByProject={groupByProject}
          isLoaded={isLoaded}
          emptyMessage={emptyMessage}
          currentWeekStart={currentWeekStart}
          collapsedWeekStarts={collapsedWeekStarts}
          collapsedProjectGroups={collapsedProjectGroups}
          getProjectDragProps={getProjectDragProps}
          onToggleWeek={handleToggleWeekGroup}
          onToggleProject={handleToggleProjectGroup}
          onOpenProject={onOpenProject}
          onOpenProjectFolder={onOpenProjectFolder}
          renderTaskRow={renderTaskRow}
        />
        {showDatabaseFooter ? (
          <div className={styles.databaseFooter}>
            {databasePath ? (
              <p className={styles.databasePath} title={databasePath}>
                {databasePath}
              </p>
            ) : (
              <p className={styles.databasePath}>No database selected</p>
            )}
            <button className={styles.databaseButton} type="button" onClick={onChooseDatabase}>
              Choose Database
            </button>
          </div>
        ) : null}
        <footer className={styles.tableFooter}>
          <div className={styles.tableStats}>
            <span>{isLoaded ? taskCountLabel : 'Loading tasks'}</span>
            {isLoaded && hasWeekGroups ? <span>{weekCountLabel}</span> : null}
          </div>
          {isLoaded && hasWeekGroups ? (
            <div className={styles.weekActions}>
              {hasCurrentWeekGroup ? (
                <button
                  className={styles.weekToggleButton}
                  type="button"
                  onClick={handleCollapseToCurrentWeek}
                  aria-label="Collapse all weeks except current week"
                  title="Collapse all but current week"
                >
                  <CalendarDays size={15} aria-hidden="true" />
                  <span>Current week</span>
                </button>
              ) : null}
              <button
                className={styles.weekToggleButton}
                type="button"
                onClick={handleToggleAllWeekGroups}
                aria-label={`${weekToggleLabel} weeks`}
                title={`${weekToggleLabel} weeks`}
              >
                {areAllWeeksCollapsed ? (
                  <ChevronDown size={15} aria-hidden="true" />
                ) : (
                  <ChevronUp size={15} aria-hidden="true" />
                )}
                <span>{weekToggleLabel}</span>
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

export default TaskTable;
