import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronUp,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import noteIcon from '../../assets/note.svg';
import { TASK_STATUS, TASK_STATUS_OPTIONS, normalizeTaskStatus } from '../../constants/taskStatus.js';
import { formatDateLabel, formatWeekLabel, getMondayWeekStartKey } from '../../utils/week.js';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog.jsx';
import EditTaskDialog from '../EditTaskDialog/EditTaskDialog.jsx';
import TaskContextMenu from '../TaskContextMenu/TaskContextMenu.jsx';
import styles from './KanbanBoard.module.css';

const INTERACTIVE_DRAG_SELECTOR = 'button, select, input, textarea, a, [role="button"]';

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

function getTaskWeekStart(task) {
  return task.weekStart || getMondayWeekStartKey(task.createdAt);
}

function getCardDropPosition(event) {
  const cardRect = event.currentTarget.getBoundingClientRect();
  const cardMiddleY = cardRect.top + cardRect.height / 2;

  return event.clientY > cardMiddleY ? 'after' : 'before';
}

function createWeekGroups(tasks) {
  const groups = new Map();

  tasks.forEach((task) => {
    const weekStart = getTaskWeekStart(task);
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

function KanbanBoard({
  tasks,
  isLoaded,
  emptyMessage = 'No tasks yet',
  onOpenProject,
  onOpenProjectFolder,
  onDeleteTask,
  onUpdateTask,
  onReorderTask,
  boardLabel = 'Kanban board',
}) {
  const didApplyDefaultWeekCollapseRef = useRef(false);
  const [draggingTaskId, setDraggingTaskId] = useState(null);
  const [dragOverTarget, setDragOverTarget] = useState(null);
  const [dragOverCard, setDragOverCard] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [pendingDeleteTask, setPendingDeleteTask] = useState(null);
  const [collapsedWeekStarts, setCollapsedWeekStarts] = useState(() => new Set());
  const weekGroups = useMemo(() => createWeekGroups(tasks), [tasks]);
  const taskCountLabel = `${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`;
  const weekCountLabel = `${weekGroups.length} ${weekGroups.length === 1 ? 'week' : 'weeks'}`;
  const hasWeekGroups = weekGroups.length > 0;
  const currentWeekStart = getMondayWeekStartKey();
  const hasCurrentWeekGroup = weekGroups.some((group) => group.weekStart === currentWeekStart);
  const areAllWeeksCollapsed =
    hasWeekGroups && weekGroups.every((group) => collapsedWeekStarts.has(group.weekStart));
  const weekToggleLabel = areAllWeeksCollapsed ? 'Expand all' : 'Collapse all';

  useEffect(() => {
    if (!isLoaded || didApplyDefaultWeekCollapseRef.current) {
      return;
    }

    const nextCollapsedWeekStarts = getCollapsedWeekStartsExceptCurrentWeek(weekGroups);

    if (!nextCollapsedWeekStarts) {
      return;
    }

    didApplyDefaultWeekCollapseRef.current = true;
    setCollapsedWeekStarts(nextCollapsedWeekStarts);
  }, [isLoaded, weekGroups]);

  function handleDragStart(task, event) {
    if (event.target.closest(INTERACTIVE_DRAG_SELECTOR)) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', task.id);
    setDraggingTaskId(task.id);
  }

  function handleDragEnd() {
    setDraggingTaskId(null);
    setDragOverTarget(null);
    setDragOverCard(null);
  }

  function canDropTaskInWeek(taskId, weekStart) {
    const task = tasks.find((currentTask) => currentTask.id === taskId);

    return Boolean(task && getTaskWeekStart(task) === weekStart);
  }

  function handleColumnDragOver(weekStart, status, event) {
    if (!canDropTaskInWeek(draggingTaskId, weekStart)) {
      event.dataTransfer.dropEffect = 'none';
      setDragOverTarget(null);
      setDragOverCard(null);
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverTarget(getDropTargetId(weekStart, status));
    setDragOverCard(null);
  }

  function handleColumnDrop(weekStart, status, event) {
    event.preventDefault();

    const taskId = event.dataTransfer.getData('text/plain') || draggingTaskId;
    const task = tasks.find((currentTask) => currentTask.id === taskId);
    const nextStatus = normalizeTaskStatus(status);

    if (!task || getTaskWeekStart(task) !== weekStart) {
      handleDragEnd();
      return;
    }

    if (onReorderTask) {
      onReorderTask({
        taskId: task.id,
        weekStart,
        status: nextStatus,
      });
    } else if (normalizeTaskStatus(task.status) !== nextStatus) {
      onUpdateTask(task.id, { status: nextStatus });
    }

    handleDragEnd();
  }

  function handleCardDragOver(weekStart, status, targetTask, event) {
    if (draggingTaskId === targetTask.id || !canDropTaskInWeek(draggingTaskId, weekStart)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    setDragOverTarget(null);
    setDragOverCard({
      taskId: targetTask.id,
      position: getCardDropPosition(event),
    });
  }

  function handleCardDragLeave(targetTask, event) {
    if (
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return;
    }

    setDragOverCard((currentDragOverCard) =>
      currentDragOverCard?.taskId === targetTask.id ? null : currentDragOverCard,
    );
  }

  function handleCardDrop(weekStart, status, targetTask, event) {
    event.preventDefault();
    event.stopPropagation();

    const taskId = event.dataTransfer.getData('text/plain') || draggingTaskId;
    const task = tasks.find((currentTask) => currentTask.id === taskId);
    const nextStatus = normalizeTaskStatus(status);

    if (!task || task.id === targetTask.id || getTaskWeekStart(task) !== weekStart) {
      handleDragEnd();
      return;
    }

    if (onReorderTask) {
      onReorderTask({
        taskId: task.id,
        targetTaskId: targetTask.id,
        weekStart,
        status: nextStatus,
        position:
          dragOverCard?.taskId === targetTask.id
            ? dragOverCard.position
            : getCardDropPosition(event),
      });
    } else if (normalizeTaskStatus(task.status) !== nextStatus) {
      onUpdateTask(task.id, { status: nextStatus });
    }

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

  function handleCollapseToCurrentWeek() {
    const nextCollapsedWeekStarts = getCollapsedWeekStartsExceptCurrentWeek(weekGroups);

    if (!nextCollapsedWeekStarts) {
      return;
    }

    setCollapsedWeekStarts(nextCollapsedWeekStarts);
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

  function renderTaskCard(task, weekStart, status) {
    const canOpenProject = Boolean(task.projectId && task.projectNumber && onOpenProject);
    const canOpenProjectFolder = Boolean(task.folderPath && onOpenProjectFolder);
    const isDragging = draggingTaskId === task.id;
    const dueDateLabel = formatDateLabel(task.dueDate);
    const cardDropPosition = dragOverCard?.taskId === task.id ? dragOverCard.position : '';
    const cardClassNames = [styles.card];

    if (isDragging) {
      cardClassNames.push(styles.draggingCard);
    }

    if (cardDropPosition === 'before') {
      cardClassNames.push(styles.cardDropBefore);
    }

    if (cardDropPosition === 'after') {
      cardClassNames.push(styles.cardDropAfter);
    }

    return (
      <article
        className={cardClassNames.join(' ')}
        draggable
        key={task.id}
        onDragStart={(event) => handleDragStart(task, event)}
        onDragEnd={handleDragEnd}
        onDragOver={(event) => handleCardDragOver(weekStart, status, task, event)}
        onDragLeave={(event) => handleCardDragLeave(task, event)}
        onDrop={(event) => handleCardDrop(weekStart, status, task, event)}
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

        <h3 className={styles.cardTitle}>
          {canOpenProjectFolder ? (
            <button
              className={styles.cardTitleButton}
              type="button"
              onClick={() => onOpenProjectFolder(task.folderPath)}
              title={task.folderPath}
              aria-label={`Open folder for ${task.projectName}`}
            >
              {task.projectName}
            </button>
          ) : (
            task.projectName
          )}
        </h3>
        <p className={styles.cardDescription}>{task.description}</p>

        {dueDateLabel ? (
          <p className={styles.cardDueDate}>
            <CalendarDays size={13} aria-hidden="true" />
            <span>Due {dueDateLabel}</span>
          </p>
        ) : null}

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
                                handleColumnDragOver(group.weekStart, status, event)
                              }
                              onDragEnter={(event) => {
                                if (canDropTaskInWeek(draggingTaskId, group.weekStart)) {
                                  setDragOverTarget(dropTargetId);
                                  setDragOverCard(null);
                                } else {
                                  event.dataTransfer.dropEffect = 'none';
                                }
                              }}
                              onDragLeave={(event) => {
                                if (
                                  event.relatedTarget instanceof Node &&
                                  event.currentTarget.contains(event.relatedTarget)
                                ) {
                                  return;
                                }

                                setDragOverTarget((currentTarget) =>
                                  currentTarget === dropTargetId ? null : currentTarget,
                                );
                              }}
                              onDrop={(event) => handleColumnDrop(group.weekStart, status, event)}
                              aria-label={`${group.label} ${status} tasks`}
                            >
                              <header className={styles.columnHeader}>
                                <span>{status}</span>
                                <small>{columnTasks.length}</small>
                              </header>
                              <div className={styles.cardList}>
                                {columnTasks.length > 0 ? (
                                  columnTasks.map((task) =>
                                    renderTaskCard(task, group.weekStart, status),
                                  )
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
          description={`Delete ${getTaskTitle(pendingDeleteTask)}?`}
          onCancel={() => setPendingDeleteTask(null)}
          onConfirm={handleConfirmDelete}
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
