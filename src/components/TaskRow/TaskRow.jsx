import { CalendarDays, GripVertical, MoreHorizontal } from 'lucide-react';
import { TASK_STATUS, TASK_STATUS_OPTIONS, normalizeTaskStatus } from '../../constants/taskStatus.js';
import noteIcon from '../../assets/note.svg';
import { formatDateLabel } from '../../utils/week.js';
import styles from './TaskRow.module.css';

function getStatusStyle(status) {
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

function getRowStatusStyle(status) {
  if (status === TASK_STATUS.IN_PROGRESS) {
    return styles.rowInProgress;
  }

  if (status === TASK_STATUS.IN_REVIEW) {
    return styles.rowInReview;
  }

  if (status === TASK_STATUS.COMPLETE) {
    return styles.rowComplete;
  }

  return styles.rowNotStarted;
}

function getWeekLabelParts(weekLabel) {
  const [weekPart, ...dateParts] = String(weekLabel || '').split(',');

  return {
    week: weekPart ? `${weekPart.trim()},` : '',
    date: dateParts.join(',').trim(),
  };
}

function TaskRow({
  task,
  rowNumber,
  layout = 'table',
  showWeekColumn = false,
  isCurrentWeek = false,
  weekLabel = '',
  mergeProjectColumns = false,
  hideProjectDetails = false,
  isNested = false,
  dropPosition = '',
  isDragging = false,
  onOpenContextMenu,
  onEditTask,
  onOpenProject,
  onOpenProjectFolder,
  onRowDragEnd,
  onRowDragLeave,
  onRowDragOver,
  onRowDragStart,
  onRowDrop,
  onStatusChange,
}) {
  const normalizedStatus = normalizeTaskStatus(task.status);
  const dueDateLabel = formatDateLabel(task.dueDate);
  const weekLabelParts = getWeekLabelParts(weekLabel);
  const canOpenProject = Boolean(task.projectId && task.projectNumber && onOpenProject);
  const canOpenProjectFolder = Boolean(task.folderPath && onOpenProjectFolder);
  const rowClassNames = [styles.taskRow, getRowStatusStyle(normalizedStatus)];
  const numberCellClassNames = [styles.numberCell];

  if (isNested) {
    rowClassNames.push(styles.nestedRow);
  }

  if (isDragging) {
    rowClassNames.push(styles.draggingRow);
  }

  if (onRowDragStart) {
    numberCellClassNames.push(styles.dragHandle);
  }

  if (dropPosition === 'before') {
    rowClassNames.push(styles.dropBefore);
  }

  if (dropPosition === 'after') {
    rowClassNames.push(styles.dropAfter);
  }

  if (layout === 'tree') {
    const treeClassNames = [styles.treeTask, getRowStatusStyle(normalizedStatus)];

    if (isDragging) treeClassNames.push(styles.treeDragging);
    if (dropPosition === 'before') treeClassNames.push(styles.treeDropBefore);
    if (dropPosition === 'after') treeClassNames.push(styles.treeDropAfter);

    function handleOpenActions(event) {
      const buttonRect = event.currentTarget.getBoundingClientRect();

      onOpenContextMenu(task, {
        preventDefault: () => event.preventDefault(),
        clientX: buttonRect.left,
        clientY: buttonRect.bottom + 4,
      });
    }

    return (
      <div
        className={treeClassNames.join(' ')}
        onContextMenu={onOpenContextMenu ? (event) => onOpenContextMenu(task, event) : undefined}
        onDragEnd={onRowDragEnd}
        onDragOver={onRowDragOver ? (event) => onRowDragOver(task, event) : undefined}
        onDragLeave={onRowDragLeave ? (event) => onRowDragLeave(task, event) : undefined}
        onDrop={onRowDrop ? (event) => onRowDrop(task, event) : undefined}
      >
        {onRowDragStart ? (
          <span
            className={`${styles.treeGrip} ${styles.dragHandle}`}
            draggable
            onDragStart={(event) => onRowDragStart(task, event)}
            title="Drag to reorder task"
            aria-label={`Drag to reorder task ${rowNumber}`}
          >
            <GripVertical size={15} aria-hidden="true" />
          </span>
        ) : null}
        <div className={styles.treeBody}>
          {onEditTask ? (
            <button
              className={styles.treeDescriptionButton}
              type="button"
              onClick={() => onEditTask(task.id)}
              aria-label={`Edit task: ${task.description}`}
            >
              {task.description}
            </button>
          ) : (
            <span className={styles.treeDescription}>{task.description}</span>
          )}
          {task.note ? (
            <p className={`${styles.taskNote} ${styles.treeNote}`}>
              <img className={styles.noteIcon} src={noteIcon} alt="" aria-hidden="true" />
              <span className={styles.noteText}>{task.note}</span>
            </p>
          ) : null}
        </div>
        <div className={styles.treeMetadata}>
          {dueDateLabel ? (
            <span className={styles.treeDueDate} title={`Due ${dueDateLabel}`}>
              <CalendarDays size={13} aria-hidden="true" />
              <span>Due {dueDateLabel}</span>
            </span>
          ) : null}
          <select
            className={`${styles.treeStatusSelect} ${getStatusStyle(normalizedStatus)}`}
            value={normalizedStatus}
            onChange={(event) => onStatusChange(task.id, normalizeTaskStatus(event.target.value))}
            onContextMenu={(event) => event.stopPropagation()}
            aria-label={`Change status for task ${rowNumber}`}
          >
            {TASK_STATUS_OPTIONS.map((statusOption) => (
              <option key={statusOption} value={statusOption}>
                {statusOption}
              </option>
            ))}
          </select>
          {onOpenContextMenu ? (
            <button
              className={styles.treeActionButton}
              type="button"
              onClick={handleOpenActions}
              onContextMenu={(event) => event.stopPropagation()}
              aria-label={`Actions for task ${rowNumber}`}
              aria-haspopup="menu"
              title="Task actions"
            >
              <MoreHorizontal size={17} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <tr
      className={rowClassNames.join(' ')}
      onContextMenu={(event) => onOpenContextMenu(task, event)}
      onDragEnd={onRowDragEnd}
      onDragOver={onRowDragOver ? (event) => onRowDragOver(task, event) : undefined}
      onDragLeave={onRowDragLeave ? (event) => onRowDragLeave(task, event) : undefined}
      onDrop={onRowDrop ? (event) => onRowDrop(task, event) : undefined}
    >
      <td
        className={numberCellClassNames.join(' ')}
        draggable={Boolean(onRowDragStart)}
        onDragStart={onRowDragStart ? (event) => onRowDragStart(task, event) : undefined}
      >
        <span>{rowNumber}</span>
      </td>
      {showWeekColumn ? (
        <td className={`${styles.weekCell} ${isCurrentWeek ? styles.currentWeekCell : ''}`}>
          {weekLabelParts.week ? (
            <span className={styles.weekLabel}>
              <span>{weekLabelParts.week}</span>
              {weekLabelParts.date ? <span>{weekLabelParts.date}</span> : null}
            </span>
          ) : null}
        </td>
      ) : null}
      {hideProjectDetails ? null : mergeProjectColumns ? (
        <td colSpan={2}>
          <span className={styles.projectWeekLabel} title={weekLabel}>
            {weekLabel}
          </span>
        </td>
      ) : (
        <>
          <td>
            {canOpenProject ? (
              <button
                className={styles.projectNumberButton}
                type="button"
                onClick={() => onOpenProject(task.projectId)}
              >
                {task.projectNumber || '-'}
              </button>
            ) : (
              <span className={styles.projectNumber}>{task.projectNumber || '-'}</span>
            )}
          </td>
          <td>
            {canOpenProjectFolder ? (
              <button
                className={styles.projectNameButton}
                type="button"
                onClick={() => onOpenProjectFolder(task.folderPath)}
                title={task.folderPath}
                aria-label={`Open folder for ${task.projectName}`}
              >
                {task.projectName}
              </button>
            ) : (
              <span className={styles.projectName}>{task.projectName}</span>
            )}
          </td>
        </>
      )}
      <td className={styles.descriptionCell} colSpan={hideProjectDetails ? 3 : 1}>
        <span className={styles.taskDescription}>{task.description}</span>
        {task.note ? (
          <p className={styles.taskNote}>
            <img className={styles.noteIcon} src={noteIcon} alt="" aria-hidden="true" />
            <span className={styles.noteText}>{task.note}</span>
          </p>
        ) : null}
      </td>
      <td className={styles.dueDateCell}>
        {dueDateLabel ? (
          <span className={styles.dueDate}>{dueDateLabel}</span>
        ) : null}
      </td>
      <td className={styles.statusCell}>
        <select
          className={`${styles.statusSelect} ${getStatusStyle(normalizedStatus)}`}
          value={normalizedStatus}
          onChange={(event) => onStatusChange(task.id, normalizeTaskStatus(event.target.value))}
          onContextMenu={(event) => event.stopPropagation()}
          aria-label={`Change status for task ${rowNumber}`}
        >
          {TASK_STATUS_OPTIONS.map((statusOption) => (
            <option key={statusOption} value={statusOption}>
              {statusOption}
            </option>
          ))}
        </select>
      </td>
    </tr>
  );
}

export default TaskRow;
