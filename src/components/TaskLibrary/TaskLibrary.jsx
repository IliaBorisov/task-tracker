import { Database, Plus, Search, Settings, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import TaskForm from '../TaskForm/TaskForm.jsx';
import styles from './TaskLibrary.module.css';

const DEFAULT_VIEW_OPTIONS = [
  { id: 'table', label: 'Table' },
  { id: 'kanban', label: 'Kanban' },
];

function TaskLibrary({
  databasePath,
  onAddTasks,
  onChooseDatabase,
  defaultTaskView = 'table',
  onDefaultTaskViewChange,
  projectLookup,
  projectSuggestions,
  onSearchQueryChange,
  searchQuery,
  searchResultCount,
  totalTaskCount,
}) {
  const [activePopup, setActivePopup] = useState(null);
  const dialogRef = useRef(null);
  const searchInputRef = useRef(null);
  const hasSearchQuery = searchQuery.trim().length > 0;
  const count = hasSearchQuery ? searchResultCount : totalTaskCount;
  const searchCountLabel = hasSearchQuery
    ? `${count} ${count === 1 ? 'match' : 'matches'}`
    : `${count} ${count === 1 ? 'task' : 'tasks'}`;
  const isAddPopup = activePopup === 'add';

  useEffect(() => {
    if (!activePopup) return undefined;

    const trigger = document.activeElement;
    const dialog = dialogRef.current;
    const initialFocus = dialog.querySelector('input') || dialog.querySelector('button');
    initialFocus?.focus();

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        // Let the project combobox dismiss its suggestions first.
        if (event.target.getAttribute('aria-expanded') === 'true') return;
        event.preventDefault();
        setActivePopup(null);
      }
      if (event.key !== 'Tab') return;

      const controls = Array.from(dialog.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
      )).filter((element) => element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (trigger?.isConnected) trigger.focus();
    };
  }, [activePopup]);

  function renderSettingsContent() {
    return (
      <div className={styles.settingsContent}>
        <div className={styles.defaultViewPanel}>
          <span className={styles.panelLabel}>Default view</span>
          <div
            className={styles.defaultViewControl}
            role="radiogroup"
            aria-label="Default task view"
          >
            {DEFAULT_VIEW_OPTIONS.map((option) => {
              const isActive = option.id === defaultTaskView;

              return (
                <button
                  className={`${styles.defaultViewButton} ${
                    isActive ? styles.activeDefaultViewButton : ''
                  }`}
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => onDefaultTaskViewChange?.(option.id)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className={styles.databaseInfo}>
          <span className={styles.panelLabel}>Database</span>
          <p className={styles.databasePath} title={databasePath || 'No database selected'}>
            {databasePath || 'No database selected'}
          </p>
        </div>
        <button className={styles.databaseButton} type="button" onClick={onChooseDatabase}>
          <Database size={18} aria-hidden="true" />
          <span>Choose database</span>
        </button>
      </div>
    );
  }

  return (
    <>
      <section className={styles.toolbar} aria-label="Task tools">
        <button
          className={`${styles.circleButton} ${styles.addButton}`}
          type="button"
          onClick={() => setActivePopup('add')}
          aria-label="Add tasks"
          aria-haspopup="dialog"
          aria-expanded={isAddPopup}
          title="Add tasks"
        >
          <Plus size={20} aria-hidden="true" />
        </button>
        <div className={styles.searchField} role="search">
          <Search className={styles.searchIcon} size={18} aria-hidden="true" />
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Search tasks"
            aria-label="Search tasks"
          />
          <span className={styles.searchCount} role="status">{searchCountLabel}</span>
          {hasSearchQuery ? (
            <button
              className={styles.clearSearchButton}
              type="button"
              onClick={() => {
                onSearchQueryChange('');
                searchInputRef.current?.focus();
              }}
              aria-label="Clear search"
              title="Clear search"
            >
              <X size={16} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <button
          className={styles.circleButton}
          type="button"
          onClick={() => setActivePopup('settings')}
          aria-label="Open settings"
          aria-haspopup="dialog"
          aria-expanded={activePopup === 'settings'}
          title="Settings"
        >
          <Settings size={19} aria-hidden="true" />
        </button>
      </section>

      {activePopup ? (
        <div
          className={styles.popupBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setActivePopup(null);
          }}
        >
          <section
            ref={dialogRef}
            className={`${styles.popupDialog} ${isAddPopup ? styles.addDialog : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-tools-popup-title"
          >
            <header className={styles.popupHeader}>
              <h2 id="task-tools-popup-title">{isAddPopup ? 'Add tasks' : 'Settings'}</h2>
              <button
                className={styles.closeButton}
                type="button"
                onClick={() => setActivePopup(null)}
                aria-label={isAddPopup ? 'Close add tasks' : 'Close settings'}
                title="Close"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>
            {isAddPopup ? (
              <div className={styles.addContent}>
                <TaskForm
                  onAddTasks={onAddTasks}
                  projectLookup={projectLookup}
                  projectSuggestions={projectSuggestions}
                />
              </div>
            ) : renderSettingsContent()}
          </section>
        </div>
      ) : null}
    </>
  );
}

export default TaskLibrary;
