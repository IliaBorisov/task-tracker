import { getMondayWeekStartKey } from './week.js';

// Refill only this week's slots, preserving other weeks and each project's task order.
export function reorderProjectsInWeek(tasks, { projectId, targetProjectId, weekStart, position }) {
  if (!projectId || !targetProjectId || projectId === targetProjectId || !weekStart) return tasks;

  const isInWeek = (task) =>
    (task.weekStart || getMondayWeekStartKey(task.createdAt)) === weekStart;
  const projects = new Map();
  tasks.filter(isInWeek).forEach((task) => {
    if (!projects.has(task.projectId)) projects.set(task.projectId, []);
    projects.get(task.projectId).push(task);
  });
  if (!projects.has(projectId) || !projects.has(targetProjectId)) return tasks;

  const ids = [...projects.keys()].filter((id) => id !== projectId);
  ids.splice(ids.indexOf(targetProjectId) + (position === 'after' ? 1 : 0), 0, projectId);
  const reordered = ids.flatMap((id) => projects.get(id));
  let index = 0;
  return tasks.map((task) => isInWeek(task) ? reordered[index++] : task);
}
