import { TASK_STATUS, TASK_STATUS_OPTIONS, normalizeTaskStatus } from '../../constants/taskStatus.js';
import noteIcon from '../../assets/note.svg';
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

function TaskRow({
  task,
  rowNumber,
  onOpenContextMenu,
  onOpenProject,
  onStatusChange,
}) {
  const normalizedStatus = normalizeTaskStatus(task.status);
  const canOpenProject = Boolean(task.projectId && task.projectNumber && onOpenProject);

  return (
    <tr
      className={`${styles.taskRow} ${getRowStatusStyle(normalizedStatus)}`}
      onContextMenu={(event) => onOpenContextMenu(task, event)}
    >
      <td className={styles.numberCell}>{rowNumber}</td>
      <td>
        {canOpenProject ? (
          <button
            className={styles.projectNumberButton}
            type="button"
            onClick={() => onOpenProject(task.projectId)}
          >
            {task.projectNumber}
          </button>
        ) : (
          <span className={styles.projectNumber}>{task.projectNumber || '-'}</span>
        )}
      </td>
      <td>
        <span className={styles.projectName}>{task.projectName}</span>
      </td>
      <td>
        <span>{task.description}</span>
        {task.note ? (
          <p className={styles.taskNote}>
            <img className={styles.noteIcon} src={noteIcon} alt="" aria-hidden="true" />
            <span className={styles.noteText}>{task.note}</span>
          </p>
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
