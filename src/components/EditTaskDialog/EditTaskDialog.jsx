import { Check, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { TASK_STATUS_OPTIONS, normalizeTaskStatus } from '../../constants/taskStatus.js';
import { getMondayWeekStartKey } from '../../utils/week.js';
import styles from './EditTaskDialog.module.css';

function createDraft(task) {
  return {
    projectNumber: task.projectNumber || '',
    projectName: task.projectName || '',
    description: task.description || '',
    note: task.note === undefined || task.note === null ? '' : String(task.note),
    status: normalizeTaskStatus(task.status),
    weekStart: task.weekStart || getMondayWeekStartKey(task.createdAt),
  };
}

function EditTaskDialog({ task, onCancel, onSave }) {
  const [draft, setDraft] = useState(() => createDraft(task));

  useEffect(() => {
    setDraft(createDraft(task));
  }, [task]);

  const canSave =
    draft.projectNumber.trim().length > 0 &&
    draft.projectName.trim().length > 0 &&
    draft.description.trim().length > 0;

  function handleProjectNumberChange(event) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      projectNumber: event.target.value,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!canSave) {
      return;
    }

    onSave(task.id, {
      projectNumber: draft.projectNumber.trim(),
      projectName: draft.projectName.trim(),
      description: draft.description.trim(),
      note: draft.note.trim(),
      status: normalizeTaskStatus(draft.status),
      weekStart: draft.weekStart,
    });
  }

  return (
    <div className={styles.backdrop} role="presentation">
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-task-title"
      >
        <header className={styles.header}>
          <h2 id="edit-task-title">Edit task</h2>
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

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>Number</span>
            <input
              value={draft.projectNumber}
              onChange={handleProjectNumberChange}
              placeholder="A104"
            />
          </label>

          <label className={styles.field}>
            <span>Name</span>
            <input
              value={draft.projectName}
              onChange={(event) =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  projectName: event.target.value,
                }))
              }
              placeholder="Website refresh"
            />
          </label>

          <label className={styles.field}>
            <span>Description</span>
            <textarea
              value={draft.description}
              onChange={(event) =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  description: event.target.value,
                }))
              }
              placeholder="Write the landing page copy"
            />
          </label>

          <label className={styles.field}>
            <span>Note</span>
            <textarea
              className={styles.noteInput}
              value={draft.note}
              onChange={(event) =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  note: event.target.value,
                }))
              }
              placeholder="Optional note"
            />
          </label>

          <label className={styles.field}>
            <span>Week</span>
            <input
              type="date"
              value={draft.weekStart}
              onChange={(event) =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  weekStart: getMondayWeekStartKey(event.target.value),
                }))
              }
            />
          </label>

          <label className={styles.field}>
            <span>Status</span>
            <select
              value={draft.status}
              onChange={(event) =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  status: event.target.value,
                }))
              }
            >
              {TASK_STATUS_OPTIONS.map((statusOption) => (
                <option key={statusOption} value={statusOption}>
                  {statusOption}
                </option>
              ))}
            </select>
          </label>

          <div className={styles.actions}>
            <button className={styles.cancelButton} type="button" onClick={onCancel}>
              Cancel
            </button>
            <button className={styles.saveButton} type="submit" disabled={!canSave}>
              <Check size={17} aria-hidden="true" />
              <span>Save</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default EditTaskDialog;
