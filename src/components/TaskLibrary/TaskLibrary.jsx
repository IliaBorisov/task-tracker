import { ChevronDown, ChevronUp, Database, Plus, Search, X } from 'lucide-react';
import { useState } from 'react';
import TaskForm from '../TaskForm/TaskForm.jsx';
import styles from './TaskLibrary.module.css';

export const TASK_LIBRARY_TABS = {
  ADD: 'add',
  DATABASE: 'database',
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
  {
    id: TASK_LIBRARY_TABS.DATABASE,
    label: 'Choose database',
    Icon: Database,
  },
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
  projectLookup,
  projectSuggestions,
  onSearchQueryChange,
  searchQuery,
  searchResultCount,
  totalTaskCount,
}) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const activeTabId = TAB_ITEMS.some((tab) => tab.id === activeTab)
    ? activeTab
    : TASK_LIBRARY_TABS.ADD;
  const hasSearchQuery = searchQuery.trim().length > 0;
  const searchCountLabel = hasSearchQuery
    ? getTaskCountLabel(searchResultCount, 'match', 'matches')
    : getTaskCountLabel(totalTaskCount, 'task', 'tasks');

  function renderActivePanel() {
    if (activeTabId === TASK_LIBRARY_TABS.DATABASE) {
      return (
        <div className={styles.databasePanel}>
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
  );
}

export default TaskLibrary;
