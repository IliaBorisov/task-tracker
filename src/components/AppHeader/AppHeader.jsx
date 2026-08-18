import styles from './AppHeader.module.css';

function AppHeader({ taskCount }) {
  return (
    <header className={styles.appHeader}>
      <div>
        <p className={styles.eyebrow}>Desktop task list</p>
        <h1 className={styles.title} id="app-title">
          Task Tracker
        </h1>
      </div>
      <div className={styles.taskCount} aria-label={`${taskCount} tasks`}>
        <span>{taskCount}</span>
        <small>{taskCount === 1 ? 'task' : 'tasks'}</small>
      </div>
    </header>
  );
}

export default AppHeader;
