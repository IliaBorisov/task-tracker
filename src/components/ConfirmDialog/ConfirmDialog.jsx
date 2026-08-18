import { Trash2, X } from 'lucide-react';
import styles from './ConfirmDialog.module.css';

function ConfirmDialog({ description, title, onCancel, onConfirm }) {
  return (
    <div className={styles.backdrop} role="presentation">
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <header className={styles.header}>
          <h2 id="confirm-dialog-title">{title}</h2>
          <button
            className={styles.closeButton}
            type="button"
            onClick={onCancel}
            title="Cancel"
            aria-label="Cancel"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <p id="confirm-dialog-description" className={styles.description}>
          {description}
        </p>

        <div className={styles.actions}>
          <button className={styles.cancelButton} type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className={styles.deleteButton} type="button" onClick={onConfirm}>
            <Trash2 size={17} aria-hidden="true" />
            <span>Delete</span>
          </button>
        </div>
      </section>
    </div>
  );
}

export default ConfirmDialog;
