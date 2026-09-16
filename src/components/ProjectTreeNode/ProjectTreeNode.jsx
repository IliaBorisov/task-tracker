import { ChevronDown, ChevronRight, Folder, FolderOpen, GripVertical } from 'lucide-react';
import { getTaskGroupStatus } from '../../constants/taskStatus.js';
import styles from './ProjectTreeNode.module.css';

function ProjectTreeNode({
  project,
  tasks,
  isExpanded,
  onToggle,
  onOpenProject,
  onOpenProjectFolder,
  childrenId,
  weekLabel = '',
  showStatus = true,
  dragRow,
  dragProps = {},
  className = '',
  children,
}) {
  const label = [project.projectNumber, project.projectName].filter(Boolean).join(' - ');
  const status = showStatus ? getTaskGroupStatus(tasks) : null;
  const headerClass = [
    styles.projectHeading,
    dragProps.isDragging ? styles.dragging : '',
    dragProps.dropPosition === 'before' ? styles.dropBefore : '',
    dragProps.dropPosition === 'after' ? styles.dropAfter : '',
  ].join(' ');

  return (
    <li className={className}>
      <div
        className={headerClass}
        onDragEnd={dragProps.onRowDragEnd}
        onDragOver={dragProps.onRowDragOver ? (event) => dragProps.onRowDragOver(dragRow, event) : undefined}
        onDragLeave={dragProps.onRowDragLeave ? (event) => dragProps.onRowDragLeave(dragRow, event) : undefined}
        onDrop={dragProps.onRowDrop ? (event) => dragProps.onRowDrop(dragRow, event) : undefined}
      >
        <button
          className={styles.disclosure}
          type="button"
          onClick={onToggle}
          aria-expanded={isExpanded}
          aria-controls={isExpanded ? childrenId : undefined}
          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${label}${weekLabel ? ` (${weekLabel})` : ''}`}
          title={isExpanded ? 'Collapse project' : 'Expand project'}
        >
          {isExpanded ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}
          {isExpanded ? <FolderOpen size={18} aria-hidden="true" /> : <Folder size={18} aria-hidden="true" />}
        </button>
        <div className={styles.projectIdentity}>
          {onOpenProject && project.projectId ? (
            <button className={styles.projectNumber} type="button" onClick={() => onOpenProject(project.projectId)} title="Open project details">{project.projectNumber}</button>
          ) : <span className={styles.projectNumber}>{project.projectNumber}</span>}
          {project.folderPath && onOpenProjectFolder ? (
            <button className={styles.projectName} type="button" onClick={() => onOpenProjectFolder(project.folderPath)} title={project.folderPath} aria-label={`Open folder for ${project.projectName}`}>{project.projectName}</button>
          ) : <span className={styles.projectName}>{project.projectName}</span>}
        </div>
        <div className={styles.projectMeta}>
          <span className={styles.taskCount}>{tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}</span>
          {status ? <span className={styles.projectStatus}>{status}</span> : null}
        </div>
        {dragProps.onRowDragStart ? (
          <span
            className={styles.dragHandle}
            draggable
            onDragStart={(event) => dragProps.onRowDragStart(dragRow, event)}
            title="Drag to reorder project within this week"
            aria-label={`Drag to reorder ${label} within this week`}
          ><GripVertical size={16} aria-hidden="true" /></span>
        ) : null}
      </div>
      {isExpanded ? children : null}
    </li>
  );
}

export default ProjectTreeNode;
