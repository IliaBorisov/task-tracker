import { ArrowLeft, CalendarDays, Check, ChevronLeft, ChevronRight, Pencil, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import TaskTable from '../TaskTable/TaskTable.jsx';
import { TASK_STATUS, normalizeTaskStatus } from '../../constants/taskStatus.js';
import { getMondayWeekStartKey } from '../../utils/week.js';
import styles from './ProjectTasksPage.module.css';

const EMPTY_PROJECT_LOOKUP = new Map();
const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'long' });
const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WORKED_WEEK_STATUS_PRIORITY = {
  [TASK_STATUS.NOT_STARTED]: 4,
  [TASK_STATUS.IN_PROGRESS]: 1,
  [TASK_STATUS.IN_REVIEW]: 2,
  [TASK_STATUS.COMPLETE]: 3,
};

function getProjectNumberKey(projectNumber) {
  return String(projectNumber || '').trim().toLowerCase();
}

function getCurrentYear() {
  return new Date().getFullYear();
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getMonthCalendarCells(year, month) {
  const firstDate = new Date(year, month, 1);
  const firstDay = firstDate.getDay();
  const daysBeforeMonth = firstDay === 0 ? 6 : firstDay - 1;
  const calendarStart = new Date(year, month, 1 - daysBeforeMonth);

  return Array.from({ length: 42 }, (_item, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);

    return {
      dateKey: formatDateKey(date),
      dayNumber: date.getDate(),
      dayOfWeek: date.getDay(),
      isCurrentMonth: date.getMonth() === month,
      weekStart: getMondayWeekStartKey(date),
    };
  });
}

function getWorkedWeekStatuses(tasks) {
  return tasks.reduce((weekStatuses, task) => {
    const status = normalizeTaskStatus(task.status);
    const weekStart = task.weekStart || getMondayWeekStartKey(task.createdAt);

    if (!weekStart) {
      return weekStatuses;
    }

    const currentStatus = weekStatuses.get(weekStart);

    if (
      !currentStatus ||
      WORKED_WEEK_STATUS_PRIORITY[status] < WORKED_WEEK_STATUS_PRIORITY[currentStatus]
    ) {
      weekStatuses.set(weekStart, status);
    }

    return weekStatuses;
  }, new Map());
}

function getWorkedWeekStatusClassName(status) {
  if (status === TASK_STATUS.NOT_STARTED) {
    return styles.workedWeekNotStarted;
  }

  if (status === TASK_STATUS.IN_PROGRESS) {
    return styles.workedWeekInProgress;
  }

  if (status === TASK_STATUS.IN_REVIEW) {
    return styles.workedWeekInReview;
  }

  if (status === TASK_STATUS.COMPLETE) {
    return styles.workedWeekComplete;
  }

  return '';
}

function ProjectTasksPage({
  projectId,
  projectName,
  projectNumber,
  tasks,
  isLoaded,
  projectLookup = EMPTY_PROJECT_LOOKUP,
  onBack,
  onDeleteTask,
  onUpdateProject,
  onUpdateTask,
  onReorderTask,
}) {
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarYear, setCalendarYear] = useState(getCurrentYear);
  const [projectDraft, setProjectDraft] = useState({
    projectNumber: projectNumber || '',
    projectName: projectName || '',
  });
  const [projectEditError, setProjectEditError] = useState('');
  const draftProjectNumberKey = getProjectNumberKey(projectDraft.projectNumber);
  const existingProjectWithDraftNumber = projectLookup.get(draftProjectNumberKey);
  const hasDuplicateProjectNumber =
    draftProjectNumberKey &&
    existingProjectWithDraftNumber &&
    existingProjectWithDraftNumber.projectId !== projectId;
  const canSaveProject =
    projectDraft.projectNumber.trim().length > 0 &&
    projectDraft.projectName.trim().length > 0 &&
    !hasDuplicateProjectNumber;
  const workedWeekStatuses = useMemo(() => getWorkedWeekStatuses(tasks), [tasks]);
  const calendarMonths = useMemo(
    () =>
      Array.from({ length: 12 }, (_item, monthIndex) => ({
        monthIndex,
        label: MONTH_FORMATTER.format(new Date(calendarYear, monthIndex, 1)),
        cells: getMonthCalendarCells(calendarYear, monthIndex),
      })),
    [calendarYear],
  );

  useEffect(() => {
    setProjectDraft({
      projectNumber: projectNumber || '',
      projectName: projectName || '',
    });
    setIsEditingProject(false);
    setProjectEditError('');
  }, [projectName, projectNumber]);

  function handleStartProjectEdit() {
    setProjectDraft({
      projectNumber: projectNumber || '',
      projectName: projectName || '',
    });
    setProjectEditError('');
    setIsEditingProject(true);
  }

  function handleOpenCalendar() {
    setCalendarYear(getCurrentYear());
    setIsCalendarOpen(true);
  }

  function handleCancelProjectEdit() {
    setProjectDraft({
      projectNumber: projectNumber || '',
      projectName: projectName || '',
    });
    setProjectEditError('');
    setIsEditingProject(false);
  }

  function handleSubmitProjectEdit(event) {
    event.preventDefault();

    if (!canSaveProject) {
      setProjectEditError(
        hasDuplicateProjectNumber
          ? 'Project number already exists.'
          : 'Project number and name are required.',
      );
      return;
    }

    const didUpdate = onUpdateProject?.(
      projectDraft.projectNumber.trim(),
      projectDraft.projectName.trim(),
    );

    if (didUpdate === false) {
      setProjectEditError('Project number already exists.');
      return;
    }

    setProjectEditError('');
    setIsEditingProject(false);
  }

  return (
    <section className={styles.projectPage} aria-labelledby="project-page-title">
      <div className={styles.projectHeader}>
        <button className={styles.backButton} type="button" onClick={onBack}>
          <ArrowLeft size={16} strokeWidth={2.4} aria-hidden="true" />
          <span>Back</span>
        </button>

        <div className={styles.projectInfo}>
          {isEditingProject ? (
            <form className={styles.projectEditForm} onSubmit={handleSubmitProjectEdit}>
              <h2 className={styles.screenReaderTitle} id="project-page-title">
                {projectNumber} {projectName}
              </h2>
              <label className={styles.projectEditField}>
                <span>Number</span>
                <input
                  value={projectDraft.projectNumber}
                  onChange={(event) =>
                    setProjectDraft((currentDraft) => ({
                      ...currentDraft,
                      projectNumber: event.target.value,
                    }))
                  }
                  aria-label="Project number"
                />
              </label>
              <label className={styles.projectEditField}>
                <span>Name</span>
                <input
                  value={projectDraft.projectName}
                  onChange={(event) =>
                    setProjectDraft((currentDraft) => ({
                      ...currentDraft,
                      projectName: event.target.value,
                    }))
                  }
                  aria-label="Project name"
                />
              </label>
              <div className={styles.projectEditActions}>
                <button
                  className={styles.projectCancelButton}
                  type="button"
                  onClick={handleCancelProjectEdit}
                  aria-label="Cancel project edit"
                  title="Cancel"
                >
                  <X size={16} aria-hidden="true" />
                </button>
                <button
                  className={styles.projectSaveButton}
                  type="submit"
                  disabled={!canSaveProject}
                  aria-label="Save project"
                  title="Save"
                >
                  <Check size={16} aria-hidden="true" />
                </button>
              </div>
              {projectEditError || hasDuplicateProjectNumber ? (
                <p className={styles.projectEditError}>
                  {projectEditError || 'Project number already exists.'}
                </p>
              ) : null}
            </form>
          ) : (
            <h2 className={styles.projectTitle} id="project-page-title">
              <span>{projectNumber}</span>
              {projectName ? (
                <>
                  <span className={styles.projectSeparator} aria-hidden="true">
                    •
                  </span>
                  <span>{projectName}</span>
                </>
              ) : null}
            </h2>
          )}
        </div>

        {!isEditingProject ? (
          <div className={styles.projectActions}>
            <button
              className={styles.calendarButton}
              type="button"
              onClick={handleOpenCalendar}
              aria-label="Open project calendar"
              title="Project calendar"
            >
              <CalendarDays size={16} aria-hidden="true" />
              <span>Calendar</span>
            </button>
            <button
              className={styles.editProjectButton}
              type="button"
              onClick={handleStartProjectEdit}
              aria-label="Edit project"
              title="Edit project"
            >
              <Pencil size={16} aria-hidden="true" />
              <span>Edit</span>
            </button>
          </div>
        ) : null}
      </div>

      <TaskTable
        tasks={tasks}
        isLoaded={isLoaded}
        onDeleteTask={onDeleteTask}
        onUpdateTask={onUpdateTask}
        onReorderTask={onReorderTask}
        showDatabaseFooter={false}
        tableLabel={`Tasks for project ${projectNumber}`}
      />

      {isCalendarOpen ? (
        <div className={styles.calendarBackdrop} role="presentation">
          <section
            className={styles.calendarDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-calendar-title"
          >
            <header className={styles.calendarHeader}>
              <div>
                <h2 id="project-calendar-title">Project calendar</h2>
                <p>
                  {projectNumber}
                  {projectName ? ` - ${projectName}` : ''}
                </p>
              </div>
              <button
                className={styles.calendarCloseButton}
                type="button"
                onClick={() => setIsCalendarOpen(false)}
                aria-label="Close calendar"
                title="Close"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <div className={styles.calendarToolbar}>
              <button
                type="button"
                onClick={() => setCalendarYear((currentYear) => currentYear - 1)}
                aria-label="Previous year"
                title="Previous year"
              >
                <ChevronLeft size={17} aria-hidden="true" />
              </button>
              <span>{calendarYear}</span>
              <button
                type="button"
                onClick={() => setCalendarYear((currentYear) => currentYear + 1)}
                aria-label="Next year"
                title="Next year"
              >
                <ChevronRight size={17} aria-hidden="true" />
              </button>
            </div>

            <div className={styles.calendarYearGrid}>
              {calendarMonths.map((month) => (
                <section className={styles.calendarMonth} key={month.monthIndex}>
                  <h3>{month.label}</h3>
                  <div className={styles.calendarWeekdays} aria-hidden="true">
                    {WEEKDAY_LABELS.map((weekdayLabel, index) => (
                      <span key={`${weekdayLabel}-${index}`}>{weekdayLabel}</span>
                    ))}
                  </div>
                  <div className={styles.calendarDays}>
                    {month.cells.map((cell, cellIndex) => {
                      const previousCell = month.cells[cellIndex - 1];
                      const nextCell = month.cells[cellIndex + 1];
                      const workedWeekStatus = workedWeekStatuses.get(cell.weekStart);
                      const isWeekday = cell.dayOfWeek >= 1 && cell.dayOfWeek <= 5;
                      const isWorkedWeekday = cell.isCurrentMonth && workedWeekStatus && isWeekday;
                      const workedWeekStatusClassName =
                        getWorkedWeekStatusClassName(workedWeekStatus);
                      const previousCellContinuesWorkedWeek =
                        previousCell?.isCurrentMonth &&
                        previousCell.weekStart === cell.weekStart &&
                        previousCell.dayOfWeek >= 1 &&
                        previousCell.dayOfWeek <= 5;
                      const nextCellContinuesWorkedWeek =
                        nextCell?.isCurrentMonth &&
                        nextCell.weekStart === cell.weekStart &&
                        nextCell.dayOfWeek >= 1 &&
                        nextCell.dayOfWeek <= 5;
                      const isVisibleWorkedWeekStart =
                        isWorkedWeekday && !previousCellContinuesWorkedWeek;
                      const isVisibleWorkedWeekEnd =
                        isWorkedWeekday && !nextCellContinuesWorkedWeek;

                      return (
                        <span
                          className={`${styles.calendarDay} ${
                            cell.isCurrentMonth ? '' : styles.outsideMonthDay
                          } ${isWorkedWeekday ? styles.workedWeekDay : ''} ${
                            isWorkedWeekday ? workedWeekStatusClassName : ''
                          } ${
                            isVisibleWorkedWeekStart ? styles.workedWeekStart : ''
                          } ${
                            isVisibleWorkedWeekEnd ? styles.workedWeekEnd : ''
                          }`}
                          key={cell.dateKey}
                          title={
                            isWorkedWeekday
                              ? `${workedWeekStatus} for week of ${cell.weekStart}`
                              : undefined
                          }
                        >
                          {cell.isCurrentMonth ? cell.dayNumber : ''}
                        </span>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

export default ProjectTasksPage;
