import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import noteIcon from '../../assets/note.svg';
import { TASK_STATUS, TASK_STATUS_OPTIONS, normalizeTaskStatus } from '../../constants/taskStatus.js';
import { formatWeekLabel, getMondayWeekStartKey } from '../../utils/week.js';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog.jsx';
import EditTaskDialog from '../EditTaskDialog/EditTaskDialog.jsx';
import TaskContextMenu from '../TaskContextMenu/TaskContextMenu.jsx';
import styles from './KanbanBoard.module.css';

function getStatusClassName(status) {
  if (status === TASK_STATUS.IN_PROGRESS) {
    return styles.inProgress;
  }

  if (status === TASK_STATUS.IN_REVIEW) {
    return styles.inReview;
  }

  if (status === TASK_STATUS.COMPLETE) {
    return styles.complete;
  }

  return styles.notStarted;
}

function getTaskTitle(task) {
  return [task.projectNumber, task.projectName].filter(Boolean).join(' - ') || 'this task';
}

function createEmptyTasksByStatus() {
  return Object.fromEntries(TASK_STATUS_OPTIONS.map((status) => [status, []]));
}

function getDropTargetId(weekStart, status) {
  return `${weekStart}:${status}`;
}

function createWeekGroups(tasks) {
  const groups = new Map();

  tasks.forEach((task) => {
    const weekStart = task.weekStart || getMondayWeekStartKey(task.createdAt);
    const status = normalizeTaskStatus(task.status);

    if (!groups.has(weekStart)) {
      groups.set(weekStart, {
        weekStart,
        label: formatWeekLabel(weekStart),
        taskCount: 0,
        tasksByStatus: createEmptyTasksByStatus(),
      });
    }

    const group = groups.get(weekStart);
    group.taskCount += 1;
    group.tasksByStatus[status].push(task);
  });

  return Array.from(groups.values()).sort((firstGroup, secondGroup) =>
    secondGroup.weekStart.localeCompare(firstGroup.weekStart),
  );
}

function KanbanBoard({
  tasks,
  isLoaded,
  emptyMessage = 'No tasks yet',
  onOpenProject,
  onDeleteTask,
  onUpdateTask,
  boardLabel = 'Kanban board',
}) {
  const [draggingTaskId, setDraggingTaskId] = useState(null);
  const [dragOverTarget, setDragOverTarget] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [pendingDeleteTask, setPendingDeleteTask] = useState(null);
  const [pendingWeekMove, setPendingWeekMove] = useState(null);
  const [collapsedWeekStarts, setCollapsedWeekStarts] = useState(() => new Set());
  const weekGroups = useMemo(() => createWeekGroups(tasks), [tasks]);
  const taskCountLabel = `${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`;
  const weekCountLabel = `${weekGroups.length} ${weekGroups.length === 1 ? 'week' : 'weeks'}`;
  const hasWeekGroups = weekGroups.length > 0;
  const areAllWeeksCollapsed =
    hasWeekGroups && weekGroups.every((group) => collapsedWeekStarts.has(group.weekStart));
  const weekToggleLabel = areAllWeeksCollapsed ? 'Expand all' : 'Collapse all';

  function handleDragStart(task, event) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', task.id);
    setDraggingTaskId(task.id);
  }

  function handleDragEnd() {
    setDraggingTaskId(null);
    setDragOverTarget(null);
  }

  function handleDragOver(weekStart, status, event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverTarget(getDropTargetId(weekStart, status));
  }

  function handleDrop(weekStart, status, event) {
    event.preventDefault();

    const taskId = event.dataTransfer.getData('text/plain') || draggingTaskId;
    const task = tasks.find((currentTask) => currentTask.id === taskId);
    const nextStatus = normalizeTaskStatus(status);
    const currentWeekStart = task
      ? task.weekStart || getMondayWeekStartKey(task.createdAt)
      : weekStart;

    if (!task) {
      handleDragEnd();
      return;
    }

    const updates = {};

    if (normalizeTaskStatus(task.status) !== nextStatus) {
      updates.status = nextStatus;
    }

    if (currentWeekStart !== weekStart) {
      updates.weekStart = weekStart;
    }

    if (Object.keys(updates).length === 0) {
      handleDragEnd();
      return;
    }

    if (currentWeekStart !== weekStart) {
      setPendingWeekMove({
        taskId: task.id,
        taskTitle: getTaskTitle(task),
        fromWeekLabel: formatWeekLabel(currentWeekStart),
        toWeekLabel: formatWeekLabel(weekStart),
        updates,
      });
      handleDragEnd();
      return;
    }

    onUpdateTask(task.id, updates);
    handleDragEnd();
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

  function handleToggleAllWeekGroups() {
    if (!hasWeekGroups) {
      return;
    }

    setCollapsedWeekStarts(
      areAllWeeksCollapsed ? new Set() : new Set(weekGroups.map((group) => group.weekStart)),
    );
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

  function handleStartEdit(task) {
    setContextMenu(null);
    setEditingTask(task);
  }

  function handleRequestDelete(task) {
    if (task) {
      setContextMenu(null);
      setPendingDeleteTask(task);
    }
  }

  function handleSaveEdit(taskId, updates) {
    onUpdateTask(taskId, updates);
    setEditingTask(null);
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

  function handleCancelWeekMove() {
    setPendingWeekMove(null);
  }

  function handleConfirmWeekMove() {
    if (!pendingWeekMove) {
      return;
    }

    onUpdateTask(pendingWeekMove.taskId, pendingWeekMove.updates);
    setPendingWeekMove(null);
  }

  function renderTaskCard(task) {
    const canOpenProject = Boolean(task.projectId && task.projectNumber && onOpenProject);
    const isDragging = draggingTaskId === task.id;

    return (
      <article
        className={`${styles.card} ${isDragging ? styles.draggingCard : ''}`}
        draggable
        key={task.id}
        onDragStart={(event) => handleDragStart(task, event)}
        onDragEnd={handleDragEnd}
        onContextMenu={(event) => handleOpenContextMenu(task, event)}
        aria-label={getTaskTitle(task)}
      >
        <div className={styles.cardHeader}>
          {canOpenProject ? (
            <button
              className={styles.projectButton}
              type="button"
              onClick={() => onOpenProject(task.projectId)}
            >
              {task.projectNumber}
            </button>
          ) : (
            <span className={styles.projectCode}>{task.projectNumber || '-'}</span>
          )}
        </div>

        <h3 className={styles.cardTitle}>{task.projectName}</h3>
        <p className={styles.cardDescription}>{task.description}</p>

        {task.note ? (
          <p className={styles.cardNote}>
            <img className={styles.noteIcon} src={noteIcon} alt="" aria-hidden="true" />
            <span>{task.note}</span>
          </p>
        ) : null}
      </article>
    );
  }

  return (
    <>
      <section className={styles.boardPanel} aria-label={boardLabel}>
        <div className={styles.boardScroll}>
          {!isLoaded ? (
            <div className={styles.emptyState}>Loading tasks</div>
          ) : tasks.length === 0 ? (
            <div className={styles.emptyState}>{emptyMessage}</div>
          ) : (
            <div className={styles.weekList}>
              {weekGroups.map((group) => {
                const isWeekCollapsed = collapsedWeekStarts.has(group.weekStart);

                return (
                  <section className={styles.weekSection} key={group.weekStart}>
                    <header className={styles.weekHeader}>
                      <button
                        className={styles.weekButton}
                        type="button"
                        onClick={() => handleToggleWeekGroup(group.weekStart)}
                        aria-expanded={!isWeekCollapsed}
                        title={isWeekCollapsed ? 'Expand week' : 'Collapse week'}
                      >
                        <span className={styles.weekLabelGroup}>
                          {isWeekCollapsed ? (
                            <ChevronRight size={16} aria-hidden="true" />
                          ) : (
                            <ChevronDown size={16} aria-hidden="true" />
                          )}
                          <span>{group.label}</span>
                        </span>
                        <small>
                          {group.taskCount === 1 ? '1 task' : `${group.taskCount} tasks`}
                        </small>
                      </button>
                    </header>
                    {isWeekCollapsed ? null : (
                      <div className={styles.columns}>
                        {TASK_STATUS_OPTIONS.map((status) => {
                          const columnTasks = group.tasksByStatus[status];
                          const dropTargetId = getDropTargetId(group.weekStart, status);
                          const isDropTarget = dragOverTarget === dropTargetId;

                          return (
                            <section
                              className={`${styles.column} ${getStatusClassName(status)} ${
                                isDropTarget ? styles.dropTarget : ''
                              }`}
                              key={status}
                              onDragOver={(event) =>
                                handleDragOver(group.weekStart, status, event)
                              }
                              onDragEnter={() => setDragOverTarget(dropTargetId)}
                              onDragLeave={() =>
                                setDragOverTarget((currentTarget) =>
                                  currentTarget === dropTargetId ? null : currentTarget,
                                )
                              }
                              onDrop={(event) => handleDrop(group.weekStart, status, event)}
                              aria-label={`${group.label} ${status} tasks`}
                            >
                              <header className={styles.columnHeader}>
                                <span>{status}</span>
                                <small>{columnTasks.length}</small>
                              </header>
                              <div className={styles.cardList}>
                                {columnTasks.length > 0 ? (
                                  columnTasks.map(renderTaskCard)
                                ) : (
                                  <p className={styles.columnEmpty}>No tasks</p>
                                )}
                              </div>
                            </section>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>
        <footer className={styles.boardFooter}>
          <div className={styles.boardStats}>
            <span>{isLoaded ? taskCountLabel : 'Loading tasks'}</span>
            {isLoaded && hasWeekGroups ? <span>{weekCountLabel}</span> : null}
          </div>
          {isLoaded && hasWeekGroups ? (
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
          ) : null}
        </footer>
      </section>

      {pendingDeleteTask ? (
        <ConfirmDialog
          title="Delete task?"
          description={`Delete ${getTaskTitle(pendingDeleteTask)}?`}
          onCancel={() => setPendingDeleteTask(null)}
          onConfirm={handleConfirmDelete}
        />
      ) : null}

      {pendingWeekMove ? (
        <ConfirmDialog
          confirmLabel="Move"
          confirmTone="primary"
          title="Move task to another week?"
          description={`Move ${pendingWeekMove.taskTitle} from ${pendingWeekMove.fromWeekLabel} to ${pendingWeekMove.toWeekLabel}?`}
          onCancel={handleCancelWeekMove}
          onConfirm={handleConfirmWeekMove}
        />
      ) : null}

      {contextMenu ? (
        <TaskContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={handleCloseContextMenu}
          onDelete={() => handleRequestDelete(contextMenu.task)}
          onEdit={() => handleStartEdit(contextMenu.task)}
        />
      ) : null}

      {editingTask ? (
        <EditTaskDialog
          task={editingTask}
          onCancel={() => setEditingTask(null)}
          onSave={handleSaveEdit}
        />
      ) : null}
    </>
  );
}

export default KanbanBoard;
