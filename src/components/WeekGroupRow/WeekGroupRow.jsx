import { ChevronDown, ChevronRight } from 'lucide-react';
import styles from './WeekGroupRow.module.css';

function WeekGroupRow({ colSpan, isCollapsed, label, onToggle, taskCount }) {
  return (
    <tr className={styles.weekRow}>
      <td colSpan={colSpan}>
        <button
          className={styles.weekButton}
          type="button"
          onClick={onToggle}
          aria-expanded={!isCollapsed}
          title={isCollapsed ? 'Expand week' : 'Collapse week'}
        >
          <span className={styles.weekLabelGroup}>
            {isCollapsed ? (
              <ChevronRight size={16} aria-hidden="true" />
            ) : (
              <ChevronDown size={16} aria-hidden="true" />
            )}
            <span>{label}</span>
          </span>
          <small>{taskCount === 1 ? '1 task' : `${taskCount} tasks`}</small>
        </button>
      </td>
    </tr>
  );
}

export default WeekGroupRow;
