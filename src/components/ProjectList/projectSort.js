const PROJECT_SORTER = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

export const PROJECT_SORT_OPTIONS = [
  { value: 'number', label: 'Number' },
  { value: 'task-count', label: 'Tasks' },
];

export function compareProjects(firstProject, secondProject, sortOrder) {
  const numberOrder = PROJECT_SORTER.compare(firstProject.projectNumber, secondProject.projectNumber);
  const nameOrder = PROJECT_SORTER.compare(firstProject.projectName, secondProject.projectName);

  switch (sortOrder) {
    case 'number-desc':
      return -numberOrder || nameOrder;
    case 'task-count-asc':
      return firstProject.tasks.length - secondProject.tasks.length || nameOrder || numberOrder;
    case 'task-count-desc':
      return secondProject.tasks.length - firstProject.tasks.length || nameOrder || numberOrder;
    default:
      return numberOrder || nameOrder;
  }
}
