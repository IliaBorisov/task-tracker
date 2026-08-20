export const TASK_STATUS = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  IN_REVIEW: 'In review',
  COMPLETE: 'Complete',
};

export const TASK_STATUS_OPTIONS = [
  TASK_STATUS.NOT_STARTED,
  TASK_STATUS.IN_PROGRESS,
  TASK_STATUS.IN_REVIEW,
  TASK_STATUS.COMPLETE,
];

export const DEFAULT_TASK_STATUS = TASK_STATUS.NOT_STARTED;

export function normalizeTaskStatus(status) {
  if (status === 'In Review') {
    return TASK_STATUS.IN_REVIEW;
  }

  return TASK_STATUS_OPTIONS.includes(status) ? status : DEFAULT_TASK_STATUS;
}
