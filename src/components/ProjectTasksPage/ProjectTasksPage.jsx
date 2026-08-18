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
          <h2 className={styles.projectTitle} id="project-page-title">
            <span>{projectNumber}</span>
            {projectName ? (
              <>
                <span className={styles.projectSeparator} aria-hidden="true">
                  •
                </span>
                <span>{projectName}</span>
              </>
            ) : null}
          </h2>
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
