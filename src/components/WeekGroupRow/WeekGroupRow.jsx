import styles from './WeekGroupRow.module.css';

function WeekGroupRow({ colSpan, label, taskCount }) {
  return (
    <tr className={styles.weekRow}>
      <td colSpan={colSpan}>
        <div className={styles.weekHeader}>
          <span>{label}</span>
          <small>{taskCount === 1 ? '1 task' : `${taskCount} tasks`}</small>
        </div>
      </td>
    </tr>
  );
}

export default WeekGroupRow;
