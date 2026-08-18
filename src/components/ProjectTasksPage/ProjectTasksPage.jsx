import { ArrowLeft } from 'lucide-react';
import TaskTable from '../TaskTable/TaskTable.jsx';
import styles from './ProjectTasksPage.module.css';

function ProjectTasksPage({
  projectName,
  projectNumber,
  tasks,
  isLoaded,
  onBack,
  onDeleteTask,
  onUpdateTask,
}) {
  return (
    <section className={styles.projectPage} aria-labelledby="project-page-title">
      <div className={styles.projectHeader}>
        <button className={styles.backButton} type="button" onClick={onBack}>
          <ArrowLeft size={16} strokeWidth={2.4} aria-hidden="true" />
          <span>Back</span>
        </button>

        <div className={styles.projectInfo}>
          <p className={styles.eyebrow}>Project</p>
          <h2 className={styles.projectTitle} id="project-page-title">
            {projectNumber}
          </h2>
          {projectName ? <p className={styles.projectName}>{projectName}</p> : null}
        </div>

        <div className={styles.taskCount} aria-label={`${tasks.length} project tasks`}>
          <span>{tasks.length}</span>
          <small>{tasks.length === 1 ? 'task' : 'tasks'}</small>
        </div>
      </div>

      <TaskTable
        tasks={tasks}
        isLoaded={isLoaded}
        onDeleteTask={onDeleteTask}
        onUpdateTask={onUpdateTask}
        showDatabaseFooter={false}
        tableLabel={`Tasks for project ${projectNumber}`}
      />
    </section>
  );
}

export default ProjectTasksPage;
