import { Pencil, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import styles from './TaskContextMenu.module.css';

function TaskContextMenu({ x, y, onClose, onDelete, onEdit }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    function handlePointerDown() {
      onClose();
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [onClose]);

  return (
    <div
      className={styles.menu}
      style={{
        left: x,
        top: y,
      }}
      role="menu"
      aria-label="Task actions"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button className={styles.menuItem} type="button" role="menuitem" onClick={onEdit}>
        <Pencil size={16} aria-hidden="true" />
        <span>Edit</span>
      </button>
      <button
        className={`${styles.menuItem} ${styles.dangerItem}`}
        type="button"
        role="menuitem"
        onClick={onDelete}
      >
        <Trash2 size={16} aria-hidden="true" />
        <span>Delete</span>
      </button>
    </div>
  );
}

export default TaskContextMenu;
