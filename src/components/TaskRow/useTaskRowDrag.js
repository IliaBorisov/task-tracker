import { useState } from 'react';
import { getMondayWeekStartKey } from '../../utils/week.js';

const INTERACTIVE_DRAG_SELECTOR = 'button, select, input, textarea, a, [role="button"]';

function getTaskWeekStart(task) {
  return task.weekStart || getMondayWeekStartKey(task.createdAt);
}

function getRowDropPosition(event) {
  const rowRect = event.currentTarget.getBoundingClientRect();

  return event.clientY > rowRect.top + rowRect.height / 2 ? 'after' : 'before';
}

function useTaskRowDrag({ tasks, onReorderTask, restrictToProject = false }) {
  const [draggingTaskId, setDraggingTaskId] = useState(null);
  const [dragOverRow, setDragOverRow] = useState(null);

  function canDropTask(draggedTask, targetTask) {
    return Boolean(
      onReorderTask &&
        draggedTask &&
        draggedTask.id !== targetTask.id &&
        getTaskWeekStart(draggedTask) === getTaskWeekStart(targetTask) &&
        (!restrictToProject || draggedTask.projectId === targetTask.projectId),
    );
  }

  function handleRowDragStart(task, event) {
    if (event.target.closest(INTERACTIVE_DRAG_SELECTOR)) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', task.id);
    setDraggingTaskId(task.id);
    setDragOverRow(null);
  }

  function handleRowDragEnd() {
    setDraggingTaskId(null);
    setDragOverRow(null);
  }

  function handleRowDragOver(targetTask, event) {
    const draggedTask = tasks.find((task) => task.id === draggingTaskId);

    if (!canDropTask(draggedTask, targetTask)) {
      event.dataTransfer.dropEffect = 'none';
      setDragOverRow(null);
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverRow({ taskId: targetTask.id, position: getRowDropPosition(event) });
  }

  function handleRowDragLeave(targetTask, event) {
    if (
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return;
    }

    setDragOverRow((current) => (current?.taskId === targetTask.id ? null : current));
  }

  function handleRowDrop(targetTask, event) {
    event.preventDefault();
    const taskId = event.dataTransfer.getData('text/plain') || draggingTaskId;
    const draggedTask = tasks.find((task) => task.id === taskId);

    if (taskId === draggingTaskId && canDropTask(draggedTask, targetTask)) {
      onReorderTask({
        taskId,
        targetTaskId: targetTask.id,
        ...(restrictToProject ? { projectId: draggedTask.projectId } : {}),
        weekStart: getTaskWeekStart(targetTask),
        position:
          dragOverRow?.taskId === targetTask.id
            ? dragOverRow.position
            : getRowDropPosition(event),
      });
    }

    handleRowDragEnd();
  }

  return function getTaskRowDragProps(task) {
    if (!onReorderTask) {
      return {};
    }

    return {
      dropPosition: dragOverRow?.taskId === task.id ? dragOverRow.position : '',
      isDragging: draggingTaskId === task.id,
      onRowDragStart: handleRowDragStart,
      onRowDragEnd: handleRowDragEnd,
      onRowDragOver: handleRowDragOver,
      onRowDragLeave: handleRowDragLeave,
      onRowDrop: handleRowDrop,
    };
  };
}

export default useTaskRowDrag;
