import { CalendarDays, ChevronDown, ChevronUp } from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog.jsx';
import EditTaskDialog from '../EditTaskDialog/EditTaskDialog.jsx';
import TaskContextMenu from '../TaskContextMenu/TaskContextMenu.jsx';
import TaskRow from '../TaskRow/TaskRow.jsx';
import WeekGroupRow from '../WeekGroupRow/WeekGroupRow.jsx';
import { formatWeekLabel, getMondayWeekStartKey } from '../../utils/week.js';
import styles from './TaskTable.module.css';

const COLUMN_DEFINITIONS = [
  { id: 'rowNumber', label: 'No', width: 72, minWidth: 56, align: 'center' },
  { id: 'projectCode', label: 'Number', width: 126, minWidth: 92 },
  { id: 'projectName', label: 'Name', width: 220, minWidth: 140 },
  { id: 'description', label: 'Description', width: 330, minWidth: 190 },
  { id: 'dueDate', label: 'Due', width: 132, minWidth: 118 },
  { id: 'status', label: 'Status', width: 120, minWidth: 120, maxWidth: 120, isResizable: false },
];

const FILL_COLUMN_ID = 'description';
const INTERACTIVE_DRAG_SELECTOR = 'button, select, input, textarea, a, [role="button"]';

function getTaskWeekStart(task) {
  return task.weekStart || getMondayWeekStartKey(task.createdAt);
}

function getRowDropPosition(event) {
  const rowRect = event.currentTarget.getBoundingClientRect();
  const rowMiddleY = rowRect.top + rowRect.height / 2;

  return event.clientY > rowMiddleY ? 'after' : 'before';
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

function createDefaultColumnWidths() {
  return Object.fromEntries(COLUMN_DEFINITIONS.map((column) => [column.id, column.width]));
}

function getColumnDefinition(columnId) {
  return COLUMN_DEFINITIONS.find((column) => column.id === columnId);
}

function getMinimumTableWidth() {
  return COLUMN_DEFINITIONS.reduce((totalWidth, column) => totalWidth + column.minWidth, 0);
}

function getFillColumnWidth(containerWidth, columnWidths) {
  const fillColumn = getColumnDefinition(FILL_COLUMN_ID);
  const otherColumnsWidth = COLUMN_DEFINITIONS.reduce((totalWidth, column) => {
    return column.id === FILL_COLUMN_ID ? totalWidth : totalWidth + columnWidths[column.id];
  }, 0);

  return Math.max(fillColumn.minWidth, Math.floor(containerWidth - otherColumnsWidth));
}

function getResizeCompanionColumnId(columnId) {
  return columnId === FILL_COLUMN_ID ? 'projectName' : FILL_COLUMN_ID;
}

function clampResizeDelta(column, companionColumn, columnWidths, delta) {
  const startWidth = columnWidths[column.id];
  const companionStartWidth = columnWidths[companionColumn.id];
  const columnMaxWidth = column.maxWidth ?? Infinity;
  const companionMaxWidth = companionColumn.maxWidth ?? Infinity;

  const minDeltaForColumn = column.minWidth - startWidth;
  const maxDeltaForColumn = columnMaxWidth - startWidth;
  const minDeltaForCompanion = companionStartWidth - companionMaxWidth;
  const maxDeltaForCompanion = companionStartWidth - companionColumn.minWidth;

  return Math.min(
    Math.min(maxDeltaForColumn, maxDeltaForCompanion),
    Math.max(Math.max(minDeltaForColumn, minDeltaForCompanion), delta),
  );
}

function resizeColumnWidths(columnWidths, columnId, delta) {
  const column = getColumnDefinition(columnId);

  if (!column || column.isResizable === false) {
    return columnWidths;
  }

  const companionColumn = getColumnDefinition(getResizeCompanionColumnId(columnId));

  if (!companionColumn) {
    return columnWidths;
  }

  const clampedDelta = clampResizeDelta(column, companionColumn, columnWidths, delta);

  if (clampedDelta === 0) {
    return columnWidths;
  }

  return {
    ...columnWidths,
    [column.id]: columnWidths[column.id] + clampedDelta,
    [companionColumn.id]: columnWidths[companionColumn.id] - clampedDelta,
  };
}

function TaskTable({
  tasks,
  isLoaded,
  databasePath,
  onOpenProject,
  onChooseDatabase,
  onDeleteTask,
  onUpdateTask,
  onReorderTask,
  emptyMessage = 'No tasks yet',
  showDatabaseFooter = true,
  tableLabel = 'Task table',
}) {
  const tableScrollRef = useRef(null);
  const didApplyDefaultWeekCollapseRef = useRef(false);
  const [editingTask, setEditingTask] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [pendingDeleteTask, setPendingDeleteTask] = useState(null);
  const [draggingTaskId, setDraggingTaskId] = useState(null);
  const [dragOverRow, setDragOverRow] = useState(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [columnWidths, setColumnWidths] = useState(createDefaultColumnWidths);
  const [collapsedWeekStarts, setCollapsedWeekStarts] = useState(() => new Set());
  const groupedTasks = useMemo(() => groupTasksByWeek(tasks), [tasks]);
  const minimumTableWidth = useMemo(getMinimumTableWidth, []);
  const columnWidthTotal = useMemo(
    () =>
      COLUMN_DEFINITIONS.reduce(
        (totalWidth, column) => totalWidth + columnWidths[column.id],
        0,
      ),
    [columnWidths],
  );
  const tableWidth = useMemo(
    () => (containerWidth > 0 ? Math.max(containerWidth, minimumTableWidth) : columnWidthTotal),
    [columnWidthTotal, containerWidth, minimumTableWidth],
  );
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
  const canReorderTasks = Boolean(onReorderTask);

  useEffect(() => {
    const tableScrollElement = tableScrollRef.current;

    if (!tableScrollElement) {
      return undefined;
    }

    function updateDefaultFillColumnWidth() {
      const nextContainerWidth = tableScrollElement.clientWidth;
      setContainerWidth(nextContainerWidth);

      setColumnWidths((currentWidths) => {
        const nextFillWidth = getFillColumnWidth(
          Math.max(nextContainerWidth, minimumTableWidth),
          currentWidths,
        );

        if (currentWidths[FILL_COLUMN_ID] === nextFillWidth) {
          return currentWidths;
        }

        return {
          ...currentWidths,
          [FILL_COLUMN_ID]: nextFillWidth,
        };
      });
    }

    updateDefaultFillColumnWidth();

    const resizeObserver = new ResizeObserver(updateDefaultFillColumnWidth);
    resizeObserver.observe(tableScrollElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [minimumTableWidth]);

  useEffect(() => {
    if (!isLoaded || didApplyDefaultWeekCollapseRef.current) {
      return;
    }

    const nextCollapsedWeekStarts = getCollapsedWeekStartsExceptCurrentWeek(groupedTasks);

    if (!nextCollapsedWeekStarts) {
      return;
    }

    didApplyDefaultWeekCollapseRef.current = true;
    setCollapsedWeekStarts(nextCollapsedWeekStarts);
  }, [groupedTasks, isLoaded]);

  function handleResizeStart(columnId, event) {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }

    const column = getColumnDefinition(columnId);

    if (!column) {
      return;
    }

    event.preventDefault();

    const startX = event.clientX;
    const startWidths = columnWidths;

    function handlePointerMove(pointerMoveEvent) {
      const nextDelta = pointerMoveEvent.clientX - startX;

      setColumnWidths(resizeColumnWidths(startWidths, columnId, nextDelta));
    }

    function handlePointerUp() {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }

  function handleResizeKeyDown(columnId, event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }

    const column = getColumnDefinition(columnId);

    if (!column) {
      return;
    }

    event.preventDefault();

    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const step = event.shiftKey ? 40 : 12;

    setColumnWidths((currentWidths) =>
      resizeColumnWidths(currentWidths, columnId, direction * step),
    );
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
    onUpdateTask(taskId, updates);
    setEditingTask(null);
  }

  function handleStatusChange(taskId, status) {
    onUpdateTask(taskId, { status });
  }

  function handleRowDragStart(task, event) {
    if (event.target.closest(INTERACTIVE_DRAG_SELECTOR)) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', task.id);
    setDraggingTaskId(task.id);
  }

  function handleRowDragEnd() {
    setDraggingTaskId(null);
    setDragOverRow(null);
  }

  function handleRowDragOver(weekStart, targetTask, event) {
    const draggedTask = tasks.find((task) => task.id === draggingTaskId);

    if (!draggedTask || draggedTask.id === targetTask.id) {
      setDragOverRow(null);
      return;
    }

    if (getTaskWeekStart(draggedTask) !== weekStart) {
      event.dataTransfer.dropEffect = 'none';
      setDragOverRow(null);
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverRow({
      taskId: targetTask.id,
      position: getRowDropPosition(event),
    });
  }

  function handleRowDragLeave(targetTask, event) {
    if (
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return;
    }

    setDragOverRow((currentDragOverRow) =>
      currentDragOverRow?.taskId === targetTask.id ? null : currentDragOverRow,
    );
  }

  function handleRowDrop(weekStart, targetTask, event) {
    event.preventDefault();

    const taskId = event.dataTransfer.getData('text/plain') || draggingTaskId;
    const draggedTask = tasks.find((task) => task.id === taskId);

    if (!draggedTask || draggedTask.id === targetTask.id) {
      handleRowDragEnd();
      return;
    }

    if (getTaskWeekStart(draggedTask) !== weekStart) {
      handleRowDragEnd();
      return;
    }

    onReorderTask({
      taskId,
      targetTaskId: targetTask.id,
      weekStart,
      position:
        dragOverRow?.taskId === targetTask.id
          ? dragOverRow.position
          : getRowDropPosition(event),
    });
    handleRowDragEnd();
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
      areAllWeeksCollapsed ? new Set() : new Set(groupedTasks.map((group) => group.weekStart)),
    );
  }

  function handleCollapseToCurrentWeek() {
    const nextCollapsedWeekStarts = getCollapsedWeekStartsExceptCurrentWeek(groupedTasks);

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

  function renderHeaderCell(column) {
    const headerClassNames = [styles.headerCell];

    if (column.align === 'center') {
      headerClassNames.push(styles.centerHeader);
    }

    if (column.maxWidth) {
      headerClassNames.push(styles.fixedWidthColumn);
    }

    return (
      <th
        className={headerClassNames.join(' ')}
        key={column.id}
        style={column.maxWidth ? { maxWidth: `${column.maxWidth}px` } : undefined}
      >
        <span className={styles.headerLabel}>{column.label}</span>
        <button
          className={styles.resizeHandle}
          type="button"
          disabled={column.isResizable === false}
          onPointerDown={(event) => handleResizeStart(column.id, event)}
          onKeyDown={(event) => handleResizeKeyDown(column.id, event)}
          aria-label={`Resize ${column.ariaLabel || column.label} column`}
          aria-orientation="vertical"
          aria-valuemin={column.minWidth}
          aria-valuenow={Math.round(columnWidths[column.id])}
          role="separator"
          title="Resize column"
        />
      </th>
    );
  }

  return (
    <>
      <section className={styles.tablePanel} aria-label={tableLabel}>
        <div className={styles.tableScroll} ref={tableScrollRef}>
          <table
            className={styles.table}
            style={{ '--table-width': `${tableWidth}px` }}
          >
            <colgroup>
              {COLUMN_DEFINITIONS.map((column) => (
                <col
                  key={column.id}
                  style={{
                    width: `${columnWidths[column.id]}px`,
                    maxWidth: column.maxWidth ? `${column.maxWidth}px` : undefined,
                  }}
                />
              ))}
            </colgroup>
            <thead>
              <tr>{COLUMN_DEFINITIONS.map(renderHeaderCell)}</tr>
            </thead>
            <tbody>
              {!isLoaded ? (
                <tr>
                  <td className={styles.emptyState} colSpan="6">
                    Loading tasks
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td className={styles.emptyState} colSpan="6">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                groupedTasks.map((group) => {
                  const isWeekCollapsed = collapsedWeekStarts.has(group.weekStart);

                  return (
                    <Fragment key={group.weekStart}>
                      <WeekGroupRow
                        colSpan={6}
                        isCollapsed={isWeekCollapsed}
                        label={group.label}
                        onToggle={() => handleToggleWeekGroup(group.weekStart)}
                        taskCount={group.tasks.length}
                      />
                      {isWeekCollapsed
                        ? null
                        : group.tasks.map(({ task, rowNumber }) => (
                            <TaskRow
                              key={task.id}
                              task={task}
                              rowNumber={rowNumber}
                              dropPosition={
                                dragOverRow?.taskId === task.id ? dragOverRow.position : ''
                              }
                              isDragging={draggingTaskId === task.id}
                              onOpenContextMenu={handleOpenContextMenu}
                              onOpenProject={onOpenProject}
                              onRowDragStart={
                                canReorderTasks ? handleRowDragStart : undefined
                              }
                              onRowDragEnd={canReorderTasks ? handleRowDragEnd : undefined}
                              onRowDragOver={
                                canReorderTasks
                                  ? (targetTask, event) =>
                                      handleRowDragOver(group.weekStart, targetTask, event)
                                  : undefined
                              }
                              onRowDragLeave={
                                canReorderTasks ? handleRowDragLeave : undefined
                              }
                              onRowDrop={
                                canReorderTasks
                                  ? (targetTask, event) =>
                                      handleRowDrop(group.weekStart, targetTask, event)
                                  : undefined
                              }
                              onStatusChange={handleStatusChange}
                            />
                          ))}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
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
