import { ChevronDown, ChevronUp, Database, Plus, Search, Settings, X } from 'lucide-react';
import { useState } from 'react';
import TaskForm from '../TaskForm/TaskForm.jsx';
import styles from './TaskLibrary.module.css';

export const TASK_LIBRARY_TABS = {
  ADD: 'add',
  SEARCH: 'search',
};

const TAB_ITEMS = [
  {
    id: TASK_LIBRARY_TABS.ADD,
    label: 'Add',
    Icon: Plus,
  },
  {
    id: TASK_LIBRARY_TABS.SEARCH,
    label: 'Search',
    Icon: Search,
  },
];

const DEFAULT_VIEW_OPTIONS = [
  { id: 'table', label: 'Table' },
  { id: 'kanban', label: 'Kanban' },
];

function getTaskCountLabel(count, singularLabel, pluralLabel) {
  return `${count} ${count === 1 ? singularLabel : pluralLabel}`;
}

function TaskLibrary({
  activeTab,
  databasePath,
  onActiveTabChange,
  onAddTask,
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
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const activeTabId = TAB_ITEMS.some((tab) => tab.id === activeTab)
    ? activeTab
    : TASK_LIBRARY_TABS.ADD;
  const hasSearchQuery = searchQuery.trim().length > 0;
  const searchCountLabel = hasSearchQuery
    ? getTaskCountLabel(searchResultCount, 'match', 'matches')
    : getTaskCountLabel(totalTaskCount, 'task', 'tasks');

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

  function renderActivePanel() {
    if (activeTabId === TASK_LIBRARY_TABS.SEARCH) {
      return (
        <div className={styles.searchPanel}>
          <label className={styles.searchField}>
            <Search className={styles.searchIcon} size={18} aria-hidden="true" />
            <input
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Search tasks"
              aria-label="Search tasks"
            />
            {hasSearchQuery ? (
              <button
                className={styles.clearSearchButton}
                type="button"
                onClick={() => onSearchQueryChange('')}
                aria-label="Clear search"
                title="Clear search"
              >
                <X size={16} aria-hidden="true" />
              </button>
            ) : null}
          </label>
          <span className={styles.searchCount}>{searchCountLabel}</span>
        </div>
      );
    }

    return (
      <TaskForm
        onAddTask={onAddTask}
        projectLookup={projectLookup}
        projectSuggestions={projectSuggestions}
      />
    );
  }

  return (
    <>
      <section
        className={`${styles.libraryPanel} ${isPanelOpen ? '' : styles.collapsedLibraryPanel}`}
        aria-label="Task tools"
      >
        <div className={styles.tabBar}>
          <div className={styles.tabList} role="tablist" aria-label="Task tools">
            {TAB_ITEMS.map(({ id, label, Icon }) => {
              const isActive = id === activeTabId;

              return (
                <button
                  className={`${styles.tabButton} ${isActive ? styles.activeTabButton : ''}`}
                  id={`task-library-tab-${id}`}
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls="task-library-panel"
                  onClick={() => {
                    onActiveTabChange(id);
                    setIsPanelOpen(true);
                  }}
                  aria-label={label}
                  title={label}
                >
                  <Icon size={17} aria-hidden="true" />
                </button>
              );
            })}
          </div>
          <button
            className={styles.settingsButton}
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Open settings"
            title="Settings"
          >
            <Settings size={17} aria-hidden="true" />
          </button>
          <button
            className={styles.foldButton}
            type="button"
            onClick={() => setIsPanelOpen((currentIsPanelOpen) => !currentIsPanelOpen)}
            aria-controls="task-library-panel"
            aria-expanded={isPanelOpen}
            aria-label={isPanelOpen ? 'Fold tools panel' : 'Unfold tools panel'}
            title={isPanelOpen ? 'Fold tools panel' : 'Unfold tools panel'}
          >
            {isPanelOpen ? (
              <ChevronUp size={17} aria-hidden="true" />
            ) : (
              <ChevronDown size={17} aria-hidden="true" />
            )}
          </button>
        </div>
        <div
          className={styles.panelBody}
          id="task-library-panel"
          role="tabpanel"
          aria-labelledby={`task-library-tab-${activeTabId}`}
          hidden={!isPanelOpen}
        >
          {isPanelOpen ? renderActivePanel() : null}
        </div>
      </section>

      {isSettingsOpen ? (
        <div
          className={styles.settingsBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsSettingsOpen(false);
            }
          }}
        >
          <section
            className={styles.settingsDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-library-settings-title"
          >
            <header className={styles.settingsHeader}>
              <h2 id="task-library-settings-title">Settings</h2>
              <button
                className={styles.settingsCloseButton}
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                aria-label="Close settings"
                title="Close"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>
            {renderSettingsContent()}
          </section>
        </div>
      ) : null}
    </>
  );
}

export default TaskLibrary;
