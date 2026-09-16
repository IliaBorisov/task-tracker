import { ChevronDown, ChevronRight } from 'lucide-react';
import { getTaskGroupStatus, TASK_STATUS } from '../../constants/taskStatus.js';
import taskRowStyles from '../TaskRow/TaskRow.module.css';
import styles from './ProjectGroupRow.module.css';

const STATUS_STYLES = {
  [TASK_STATUS.NOT_STARTED]: taskRowStyles.notStarted,
  [TASK_STATUS.IN_PROGRESS]: taskRowStyles.inProgress,
  [TASK_STATUS.IN_REVIEW]: taskRowStyles.inReview,
  [TASK_STATUS.COMPLETE]: taskRowStyles.complete,
};

function ProjectGroupRow({
  project,
  dragRow,
  dropPosition = '',
  isDragging = false,
  onRowDragStart,
  onRowDragEnd,
  onRowDragOver,
  onRowDragLeave,
  onRowDrop,
  rowNumber,
  tasks,
  isExpanded,
  onToggle,
  onOpenProject,
  onOpenProjectFolder,
  weekLabel = '',
}) {
  const projectLabel = [project.projectNumber, project.projectName].filter(Boolean).join(' - ');
  const toggleLabel = `${isExpanded ? 'Collapse' : 'Expand'} ${projectLabel}${weekLabel ? ` (${weekLabel})` : ''}`;
  const canOpenProject = Boolean(project.projectId && onOpenProject);
  const canOpenProjectFolder = Boolean(project.folderPath && onOpenProjectFolder);
  const taskCount = tasks.length;
  const status = getTaskGroupStatus(tasks);

  return (
    <tr
      className={[styles.projectRow, isDragging ? taskRowStyles.draggingRow : '',
        dropPosition === 'before' ? taskRowStyles.dropBefore : '',
        dropPosition === 'after' ? taskRowStyles.dropAfter : ''].join(' ')}
      onDragEnd={onRowDragEnd}
      onDragOver={onRowDragOver ? (event) => onRowDragOver(dragRow, event) : undefined}
      onDragLeave={onRowDragLeave ? (event) => onRowDragLeave(dragRow, event) : undefined}
      onDrop={onRowDrop ? (event) => onRowDrop(dragRow, event) : undefined}
    >
      <td className={styles.projectIndexCell}>
        <button
          className={styles.expandButton}
          type="button"
          onClick={onToggle}
          aria-expanded={isExpanded}
          aria-label={toggleLabel}
          title={isExpanded ? 'Collapse project' : 'Expand project'}
        >
          {isExpanded ? (
            <ChevronDown size={16} aria-hidden="true" />
          ) : (
            <ChevronRight size={16} aria-hidden="true" />
          )}
          <span>{rowNumber}</span>
        </button>
      </td>
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
      <td
        className={`${styles.projectTaskSummary} ${onRowDragStart ? taskRowStyles.dragHandle : ''}`}
        draggable={Boolean(onRowDragStart)}
        onDragStart={onRowDragStart ? (event) => onRowDragStart(dragRow, event) : undefined}
        title={onRowDragStart ? 'Drag to reorder project within this week' : undefined}
      >
        {taskCount === 1 ? '1 task' : `${taskCount} tasks`}
      </td>
      <td />
      <td className={taskRowStyles.statusCell}>
        {status ? (
          <span className={`${taskRowStyles.statusSelect} ${STATUS_STYLES[status]} ${styles.statusBadge}`}>
            {status}
          </span>
        ) : null}
      </td>
    </tr>
  );
}

export default ProjectGroupRow;
