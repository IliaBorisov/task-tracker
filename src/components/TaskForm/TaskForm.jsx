import { Plus, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DEFAULT_TASK_STATUS, TASK_STATUS_OPTIONS } from '../../constants/taskStatus.js';
import { formatWeekLabel, getMondayWeekStartKey, normalizeDateKey } from '../../utils/week.js';
import styles from './TaskForm.module.css';

const EMPTY_PROJECT_LOOKUP = new Map();
const EMPTY_PROJECT_SUGGESTIONS = [];
const MAX_PROJECT_SUGGESTIONS = 8;

function createTaskDraft(id) {
  return { id, description: '', dueDate: '', status: DEFAULT_TASK_STATUS };
}

function getProjectNumberKey(projectNumber) {
  return String(projectNumber || '').trim().toLowerCase();
}

function getMatchingProjectSuggestions(projectSuggestions, projectNumber) {
  const projectNumberKey = getProjectNumberKey(projectNumber);

  if (!projectNumberKey) {
    return projectSuggestions.slice(0, MAX_PROJECT_SUGGESTIONS);
  }

  return projectSuggestions
    .filter((project) => project.projectNumberKey.includes(projectNumberKey))
    .slice(0, MAX_PROJECT_SUGGESTIONS);
}

function TaskForm({
  onAddTasks,
  projectLookup = EMPTY_PROJECT_LOOKUP,
  projectSuggestions = EMPTY_PROJECT_SUGGESTIONS,
}) {
  const projectNumberListId = useId();
  const projectNumberInputRef = useRef(null);
  const lastAutoFilledProjectNameRef = useRef('');
  const nextDraftIdRef = useRef(1);
  const descriptionInputsRef = useRef(new Map());
  const draftToFocusRef = useRef(null);
  const [projectNumber, setProjectNumber] = useState('');
  const [projectName, setProjectName] = useState('');
  const [weekStart, setWeekStart] = useState(() => getMondayWeekStartKey());
  const [taskDrafts, setTaskDrafts] = useState(() => [createTaskDraft(0)]);
  const [addedTaskCount, setAddedTaskCount] = useState(0);
  const [isProjectNumberFocused, setIsProjectNumberFocused] = useState(false);
  const [activeProjectSuggestionIndex, setActiveProjectSuggestionIndex] = useState(-1);
  const [suggestionMenuPosition, setSuggestionMenuPosition] = useState(null);
  const matchingProjectSuggestions = useMemo(
    () => getMatchingProjectSuggestions(projectSuggestions, projectNumber),
    [projectNumber, projectSuggestions],
  );
  const showProjectSuggestions =
    isProjectNumberFocused && matchingProjectSuggestions.length > 0;

  useEffect(() => {
    if (draftToFocusRef.current !== null) {
      descriptionInputsRef.current.get(draftToFocusRef.current)?.focus();
      draftToFocusRef.current = null;
    }
  }, [taskDrafts]);

  useEffect(() => {
    setActiveProjectSuggestionIndex(-1);
  }, [projectNumber, matchingProjectSuggestions]);

  useEffect(() => {
    if (!showProjectSuggestions) {
      setSuggestionMenuPosition(null);
      return undefined;
    }

    function updateSuggestionMenuPosition() {
      const inputRect = projectNumberInputRef.current?.getBoundingClientRect();

      if (!inputRect) {
        return;
      }

      setSuggestionMenuPosition({
        top: inputRect.bottom + 4,
        left: inputRect.left,
        width: inputRect.width,
      });
    }

    updateSuggestionMenuPosition();
    window.addEventListener('resize', updateSuggestionMenuPosition);
    window.addEventListener('scroll', updateSuggestionMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateSuggestionMenuPosition);
      window.removeEventListener('scroll', updateSuggestionMenuPosition, true);
    };
  }, [showProjectSuggestions, matchingProjectSuggestions]);

  const canAddTasks = useMemo(() => {
    return (
      projectNumber.trim().length > 0 &&
      projectName.trim().length > 0 &&
      Boolean(normalizeDateKey(weekStart)) &&
      taskDrafts.every((task) => task.description.trim().length > 0)
    );
  }, [taskDrafts, projectName, projectNumber, weekStart]);

  function applyProjectNumberValue(nextProjectNumber, nextProjectSuggestion) {
    setAddedTaskCount(0);
    const canUseExistingName =
      projectName.trim().length === 0 ||
      projectName === lastAutoFilledProjectNameRef.current;

    setProjectNumber(nextProjectNumber);

    if (nextProjectSuggestion && canUseExistingName) {
      setProjectName(nextProjectSuggestion.projectName);
      lastAutoFilledProjectNameRef.current = nextProjectSuggestion.projectName;
      return;
    }

    if (!nextProjectSuggestion && projectName === lastAutoFilledProjectNameRef.current) {
      setProjectName('');
      lastAutoFilledProjectNameRef.current = '';
    }
  }

  function handleProjectNumberChange(event) {
    const nextProjectNumber = event.target.value;
    const nextProjectSuggestion = projectLookup.get(getProjectNumberKey(nextProjectNumber));

    applyProjectNumberValue(nextProjectNumber, nextProjectSuggestion);
  }

  function handleProjectNumberKeyDown(event) {
    if (!showProjectSuggestions) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveProjectSuggestionIndex((currentIndex) =>
        Math.min(currentIndex + 1, matchingProjectSuggestions.length - 1),
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveProjectSuggestionIndex((currentIndex) => Math.max(currentIndex - 1, 0));
      return;
    }

    if (event.key === 'Enter' && activeProjectSuggestionIndex >= 0) {
      event.preventDefault();
      applyProjectNumberValue(
        matchingProjectSuggestions[activeProjectSuggestionIndex].projectNumber,
        matchingProjectSuggestions[activeProjectSuggestionIndex],
      );
      setIsProjectNumberFocused(false);
      return;
    }

    if (event.key === 'Escape') {
      setIsProjectNumberFocused(false);
    }
  }

  function handleProjectSuggestionClick(project) {
    applyProjectNumberValue(project.projectNumber, project);
    setIsProjectNumberFocused(false);
  }

  function handleProjectNameChange(event) {
    setAddedTaskCount(0);
    lastAutoFilledProjectNameRef.current = '';
    setProjectName(event.target.value);
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!canAddTasks) {
      return;
    }

    const didAdd = onAddTasks({
      projectNumber: projectNumber.trim(),
      projectName: projectName.trim(),
      weekStart,
      tasks: taskDrafts.map(({ description, dueDate, status }) => ({
        description: description.trim(),
        dueDate,
        status,
      })),
    });

    if (didAdd === false) {
      return;
    }

    setProjectNumber(projectNumber.trim());
    setProjectName(projectName.trim());
    lastAutoFilledProjectNameRef.current = projectName.trim();
    setAddedTaskCount(taskDrafts.length);
    const nextDraft = createTaskDraft(nextDraftIdRef.current++);
    draftToFocusRef.current = nextDraft.id;
    setTaskDrafts([nextDraft]);
  }

  function handleUpdateDraft(draftId, updates) {
    setAddedTaskCount(0);
    setTaskDrafts((currentDrafts) =>
      currentDrafts.map((draft) => (draft.id === draftId ? { ...draft, ...updates } : draft)),
    );
  }

  function handleAddDraft() {
    const nextDraft = createTaskDraft(nextDraftIdRef.current++);
    draftToFocusRef.current = nextDraft.id;
    setAddedTaskCount(0);
    setTaskDrafts((currentDrafts) => [...currentDrafts, nextDraft]);
  }

  function handleRemoveDraft(draftId) {
    if (taskDrafts.length === 1) {
      return;
    }

    const draftIndex = taskDrafts.findIndex((draft) => draft.id === draftId);
    draftToFocusRef.current = taskDrafts[draftIndex + 1]?.id ?? taskDrafts[draftIndex - 1]?.id;
    setAddedTaskCount(0);
    setTaskDrafts((currentDrafts) => currentDrafts.filter((draft) => draft.id !== draftId));
  }

  const projectSuggestionMenu =
    showProjectSuggestions && suggestionMenuPosition && typeof document !== 'undefined'
      ? createPortal(
          <div
            className={styles.suggestionMenu}
            id={projectNumberListId}
            role="listbox"
            aria-label="Project number suggestions"
            style={{
              top: suggestionMenuPosition.top,
              left: suggestionMenuPosition.left,
              width: suggestionMenuPosition.width,
            }}
          >
            {matchingProjectSuggestions.map((project, index) => (
              <button
                className={`${styles.suggestionOption} ${
                  index === activeProjectSuggestionIndex
                    ? styles.activeSuggestionOption
                    : ''
                }`}
                key={project.projectNumberKey}
                id={`${projectNumberListId}-${index}`}
                type="button"
                role="option"
                aria-selected={index === activeProjectSuggestionIndex}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleProjectSuggestionClick(project)}
              >
                <span>{project.projectNumber}</span>
                <span>{project.projectName}</span>
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <form className={styles.taskForm} onSubmit={handleSubmit} aria-label="Add task">
      <div className={styles.projectFields}>
        <div
          className={styles.field}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setIsProjectNumberFocused(false);
            }
          }}
        >
          <label className={styles.fieldLabel} htmlFor={`${projectNumberListId}-input`}>Number</label>
          <input
            id={`${projectNumberListId}-input`}
            ref={projectNumberInputRef}
            value={projectNumber}
            onChange={handleProjectNumberChange}
            onFocus={() => setIsProjectNumberFocused(true)}
            onKeyDown={handleProjectNumberKeyDown}
            placeholder="Project Number"
            aria-label="Project Number"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showProjectSuggestions}
            aria-controls={projectNumberListId}
            aria-activedescendant={
              activeProjectSuggestionIndex >= 0
                ? `${projectNumberListId}-${activeProjectSuggestionIndex}`
                : undefined
            }
          />
          {projectSuggestionMenu}
        </div>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Name</span>
          <input
            value={projectName}
            onChange={handleProjectNameChange}
            placeholder="Project Name"
            aria-label="Project Name"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Week beginning</span>
          <input
            type="date"
            value={weekStart}
            onChange={(event) => {
              const nextDate = normalizeDateKey(event.target.value);
              setWeekStart(nextDate ? getMondayWeekStartKey(nextDate) : '');
              setAddedTaskCount(0);
            }}
            aria-label="Week beginning"
            title={weekStart ? formatWeekLabel(weekStart) : 'Choose a week'}
          />
        </label>
      </div>

      <div className={styles.taskDrafts}>
        {taskDrafts.map((draft, index) => (
          <div className={styles.taskDraft} key={draft.id} role="group" aria-label={`Task ${index + 1}`}>
            <label className={`${styles.field} ${styles.descriptionField}`}>
              <span className={styles.fieldLabel}>Task {index + 1}</span>
              <input
                ref={(element) => {
                  if (element) {
                    descriptionInputsRef.current.set(draft.id, element);
                  } else {
                    descriptionInputsRef.current.delete(draft.id);
                  }
                }}
                value={draft.description}
                onChange={(event) => handleUpdateDraft(draft.id, { description: event.target.value })}
                placeholder="Task description"
                aria-label={`Task ${index + 1} description`}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Due</span>
              <div className={styles.dateInputWrap}>
                <input
                  type="date"
                  value={draft.dueDate}
                  onChange={(event) => handleUpdateDraft(draft.id, { dueDate: event.target.value })}
                  aria-label={`Task ${index + 1} due date`}
                />
                {draft.dueDate ? (
                  <button
                    className={styles.clearDateButton}
                    type="button"
                    onClick={() => handleUpdateDraft(draft.id, { dueDate: '' })}
                    aria-label={`Clear due date for task ${index + 1}`}
                    title="No due date"
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Status</span>
              <select
                value={draft.status}
                onChange={(event) => handleUpdateDraft(draft.id, { status: event.target.value })}
                aria-label={`Task ${index + 1} status`}
              >
                {TASK_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>

            <button
              className={styles.removeTaskButton}
              type="button"
              disabled={taskDrafts.length === 1}
              onClick={() => handleRemoveDraft(draft.id)}
              aria-label={`Remove task ${index + 1}`}
              title="Remove task"
            >
              <X size={17} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      <div className={styles.formActions}>
        <button className={styles.addAnotherButton} type="button" onClick={handleAddDraft}>
          <Plus size={16} aria-hidden="true" />
          <span>Add another task</span>
        </button>
        <span className={styles.addedMessage} role="status">
          {addedTaskCount > 0 ? `${addedTaskCount} ${addedTaskCount === 1 ? 'task' : 'tasks'} added.` : ''}
        </span>
        <button
          className={styles.primaryButton}
          type="submit"
          disabled={!canAddTasks}
        >
          <Plus size={18} aria-hidden="true" />
          <span>{taskDrafts.length === 1 ? 'Add task' : `Add ${taskDrafts.length} tasks`}</span>
        </button>
      </div>
    </form>
  );
}

export default TaskForm;
