import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import databaseIcon from '../../assets/database.svg';
import styles from './TaskForm.module.css';

function TaskForm({ databasePath, onAddTask, onChooseDatabase }) {
  const [projectNumber, setProjectNumber] = useState('');
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');

  const canAddTask = useMemo(() => {
    return (
      projectNumber.trim().length > 0 &&
      projectName.trim().length > 0 &&
      description.trim().length > 0
    );
  }, [description, projectName, projectNumber]);

  function handleProjectNumberChange(event) {
    setProjectNumber(event.target.value.replace(/[^a-z0-9]/gi, ''));
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!canAddTask) {
      return;
    }

    onAddTask(projectNumber.trim(), projectName.trim(), description.trim());
    setProjectNumber('');
    setProjectName('');
    setDescription('');
  }

  return (
    <form className={styles.taskForm} onSubmit={handleSubmit}>
      <button
        className={styles.databaseButton}
        type="button"
        onClick={onChooseDatabase}
        aria-label="Choose Database"
        title={databasePath || 'Choose Database'}
      >
        <img className={styles.databaseIcon} src={databaseIcon} alt="" aria-hidden="true" />
      </button>

      <label className={`${styles.field} ${styles.projectNumberField}`}>
        <input
          value={projectNumber}
          onChange={handleProjectNumberChange}
          placeholder="Project Number"
          aria-label="Project Number"
        />
      </label>

      <label className={styles.field}>
        <input
          value={projectName}
          onChange={(event) => setProjectName(event.target.value)}
          placeholder="Project Name"
          aria-label="Project Name"
        />
      </label>

      <label className={styles.field}>
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Task Description"
          aria-label="Task Description"
        />
      </label>

      <button
        className={styles.primaryButton}
        type="submit"
        disabled={!canAddTask}
        aria-label="Add Task"
        title="Add Task"
      >
        <Plus size={18} aria-hidden="true" />
      </button>
    </form>
  );
}

export default TaskForm;
