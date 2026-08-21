import { Plus } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './TaskForm.module.css';

const EMPTY_PROJECT_LOOKUP = new Map();
const EMPTY_PROJECT_SUGGESTIONS = [];
const MAX_PROJECT_SUGGESTIONS = 8;

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
  onAddTask,
  projectLookup = EMPTY_PROJECT_LOOKUP,
  projectSuggestions = EMPTY_PROJECT_SUGGESTIONS,
}) {
  const projectNumberListId = useId();
  const projectNumberInputRef = useRef(null);
  const lastAutoFilledProjectNameRef = useRef('');
  const [projectNumber, setProjectNumber] = useState('');
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
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

  const canAddTask = useMemo(() => {
    return (
      projectNumber.trim().length > 0 &&
      projectName.trim().length > 0 &&
      description.trim().length > 0
    );
  }, [description, projectName, projectNumber]);

  function applyProjectNumberValue(nextProjectNumber, nextProjectSuggestion) {
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
    lastAutoFilledProjectNameRef.current = '';
    setProjectName(event.target.value);
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
    lastAutoFilledProjectNameRef.current = '';
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
      <div
        className={styles.field}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setIsProjectNumberFocused(false);
          }
        }}
      >
        <input
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
        <input
          value={projectName}
          onChange={handleProjectNameChange}
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
