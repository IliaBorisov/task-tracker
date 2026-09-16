import { CalendarDays, ChevronDown, ChevronRight, FolderOpen } from 'lucide-react';
import { useId } from 'react';
import ProjectTreeNode from '../ProjectTreeNode/ProjectTreeNode.jsx';
import styles from './TaskTree.module.css';

function TaskTree({
  groups,
  groupByProject = true,
  isLoaded,
  emptyMessage,
  currentWeekStart,
  collapsedWeekStarts,
  collapsedProjectGroups,
  getProjectDragProps,
  onToggleWeek,
  onToggleProject,
  onOpenProject,
  onOpenProjectFolder,
  renderTaskRow,
}) {
  const treeId = useId();

  if (!isLoaded || groups.length === 0) {
    return (
      <div className={styles.emptyState} role="status">
        <FolderOpen size={28} strokeWidth={1.4} aria-hidden="true" />
        <p>{isLoaded ? emptyMessage : 'Loading tasks'}</p>
      </div>
    );
  }

  return (
    <div className={styles.treeScroll}>
      <ul className={styles.weeks} aria-label={groupByProject ? 'Tasks by week and project' : 'Tasks by week'}>
        {groups.map((group, weekIndex) => {
          const isWeekExpanded = !collapsedWeekStarts.has(group.weekStart);
          const weekChildrenId = `${treeId}-week-${weekIndex}`;
          const [weekLabel, ...dateLabel] = group.label.split(',');

          return (
            <li key={group.weekStart} className={`${styles.weekBranch} ${styles.borderedWeek}`}>
              <button
                className={styles.weekHeading}
                type="button"
                onClick={() => onToggleWeek(group.weekStart)}
                aria-expanded={isWeekExpanded}
                aria-controls={isWeekExpanded ? weekChildrenId : undefined}
                aria-label={`${isWeekExpanded ? 'Collapse' : 'Expand'} ${group.label}`}
              >
                {isWeekExpanded ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
                <CalendarDays size={17} className={styles.branchIcon} aria-hidden="true" />
                <span className={styles.weekTitle}>{weekLabel}</span>
                <span className={styles.weekDate}>{dateLabel.join(',').trim()}</span>
                {group.weekStart === currentWeekStart ? <span className={styles.currentWeek}>Current week</span> : null}
                <span className={styles.weekCount}>
                  {groupByProject ? `${group.projects.length} ${group.projects.length === 1 ? 'project' : 'projects'} · ` : ''}
                  {group.tasks.length} {group.tasks.length === 1 ? 'task' : 'tasks'}
                </span>
              </button>
              {isWeekExpanded && groupByProject ? (
                <ul id={weekChildrenId} className={styles.projects} aria-label={`Projects in ${group.label}`}>
                  {group.projects.map((project, projectIndex) => {
                    const groupKey = JSON.stringify([group.weekStart, project.projectId]);
                    const isExpanded = !collapsedProjectGroups.has(groupKey);
                    const projectChildrenId = `${weekChildrenId}-project-${projectIndex}`;
                    const dragRow = { ...project, id: groupKey, weekStart: group.weekStart };
                    const drag = getProjectDragProps(dragRow);
                    const label = [project.projectNumber, project.projectName].filter(Boolean).join(' - ');
                    return (
                      <ProjectTreeNode
                        key={project.projectId}
                        project={project}
                        tasks={project.tasks.map(({ task }) => task)}
                        isExpanded={isExpanded}
                        onToggle={() => onToggleProject(groupKey)}
                        onOpenProject={onOpenProject}
                        onOpenProjectFolder={onOpenProjectFolder}
                        childrenId={projectChildrenId}
                        weekLabel={group.label}
                        dragRow={dragRow}
                        dragProps={drag}
                        className={styles.projectBranch}
                      >
                        {isExpanded ? (
                          <ul id={projectChildrenId} className={styles.tasks} aria-label={`Tasks for ${label}`}>
                            {project.tasks.map((entry) => (
                              <li key={entry.task.id} className={styles.taskBranch}>
                                {renderTaskRow(entry, projectIndex + 1)}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </ProjectTreeNode>
                    );
                  })}
                </ul>
              ) : isWeekExpanded ? (
                <ul id={weekChildrenId} className={styles.weekTasks} aria-label={`Tasks in ${group.label}`}>
                  {group.tasks.map((entry) => (
                    <li key={entry.task.id} className={styles.taskBranch}>
                      {renderTaskRow(entry)}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default TaskTree;
