import styles from './IncompleteTasksToggle.module.css';

function IncompleteTasksToggle({ active, onChange }) {
  return (
    <button
      className={`${styles.toggle} ${active ? styles.active : ''}`}
      type="button"
      role="switch"
      aria-checked={active}
      onClick={() => onChange(!active)}
      title={active ? 'Show all tasks' : 'Show only incomplete tasks'}
    >
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
      <span>Incomplete only</span>
    </button>
  );
}

export default IncompleteTasksToggle;
