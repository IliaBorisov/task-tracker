import { useEffect, useMemo, useRef, useState } from 'react';
import { TASK_TABLE_COLUMNS } from './columns.js';
import styles from './ResizableTable.module.css';

const FILL_COLUMN_ID = 'description';

function createDefaultColumnWidths(columns) {
  return Object.fromEntries(columns.map((column) => [column.id, column.width]));
}

function getColumnDefinition(columns, columnId) {
  return columns.find((column) => column.id === columnId);
}

function getMinimumTableWidth(columns) {
  return columns.reduce((totalWidth, column) => totalWidth + column.minWidth, 0);
}

function getFillColumnWidth(columns, containerWidth, columnWidths) {
  const fillColumn = getColumnDefinition(columns, FILL_COLUMN_ID);
  const otherColumnsWidth = columns.reduce((totalWidth, column) => {
    return column.id === FILL_COLUMN_ID ? totalWidth : totalWidth + columnWidths[column.id];
  }, 0);

  return Math.max(fillColumn.minWidth, Math.floor(containerWidth - otherColumnsWidth));
}

function getResizeCompanionColumnId(columnId) {
  return columnId === FILL_COLUMN_ID ? 'projectName' : FILL_COLUMN_ID;
}

function clampResizeDelta(column, companionColumn, columnWidths, delta) {
  const startWidth = columnWidths[column.id];
  const companionStartWidth = columnWidths[companionColumn.id];
  const columnMaxWidth = column.maxWidth ?? Infinity;
  const companionMaxWidth = companionColumn.maxWidth ?? Infinity;

  const minDeltaForColumn = column.minWidth - startWidth;
  const maxDeltaForColumn = columnMaxWidth - startWidth;
  const minDeltaForCompanion = companionStartWidth - companionMaxWidth;
  const maxDeltaForCompanion = companionStartWidth - companionColumn.minWidth;

  return Math.min(
    Math.min(maxDeltaForColumn, maxDeltaForCompanion),
    Math.max(Math.max(minDeltaForColumn, minDeltaForCompanion), delta),
  );
}

function resizeColumnWidths(columns, columnWidths, columnId, delta) {
  const column = getColumnDefinition(columns, columnId);

  if (!column || column.isResizable === false) {
    return columnWidths;
  }

  const companionColumn = getColumnDefinition(columns, getResizeCompanionColumnId(columnId));

  if (!companionColumn) {
    return columnWidths;
  }

  const clampedDelta = clampResizeDelta(column, companionColumn, columnWidths, delta);

  if (clampedDelta === 0) {
    return columnWidths;
  }

  return {
    ...columnWidths,
    [column.id]: columnWidths[column.id] + clampedDelta,
    [companionColumn.id]: columnWidths[companionColumn.id] - clampedDelta,
  };
}

function ResizableTable({ columns = TASK_TABLE_COLUMNS, children }) {
  const tableScrollRef = useRef(null);
  const resizeCleanupRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [columnWidths, setColumnWidths] = useState(() => createDefaultColumnWidths(columns));
  const minimumTableWidth = useMemo(() => getMinimumTableWidth(columns), [columns]);
  const columnWidthTotal = useMemo(
    () =>
      columns.reduce(
        (totalWidth, column) => totalWidth + columnWidths[column.id],
        0,
      ),
    [columns, columnWidths],
  );
  const tableWidth = useMemo(
    () => (containerWidth > 0 ? Math.max(containerWidth, minimumTableWidth) : columnWidthTotal),
    [columnWidthTotal, containerWidth, minimumTableWidth],
  );

  useEffect(() => () => resizeCleanupRef.current?.(), []);

  useEffect(() => {
    const tableScrollElement = tableScrollRef.current;

    if (!tableScrollElement) {
      return undefined;
    }

    function updateDefaultFillColumnWidth() {
      const nextContainerWidth = tableScrollElement.clientWidth;
      setContainerWidth(nextContainerWidth);

      setColumnWidths((currentWidths) => {
        const nextFillWidth = getFillColumnWidth(
          columns,
          Math.max(nextContainerWidth, minimumTableWidth),
          currentWidths,
        );

        if (currentWidths[FILL_COLUMN_ID] === nextFillWidth) {
          return currentWidths;
        }

        return {
          ...currentWidths,
          [FILL_COLUMN_ID]: nextFillWidth,
        };
      });
    }

    updateDefaultFillColumnWidth();

    const resizeObserver = new ResizeObserver(updateDefaultFillColumnWidth);
    resizeObserver.observe(tableScrollElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [columns, minimumTableWidth]);

  function handleResizeStart(columnId, event) {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }

    const column = getColumnDefinition(columns, columnId);

    if (!column || column.isResizable === false) {
      return;
    }

    event.preventDefault();
    resizeCleanupRef.current?.();

    const startX = event.clientX;
    const startWidths = columnWidths;

    function handlePointerMove(pointerMoveEvent) {
      const nextDelta = pointerMoveEvent.clientX - startX;

      setColumnWidths(resizeColumnWidths(columns, startWidths, columnId, nextDelta));
    }

    function handlePointerUp() {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      resizeCleanupRef.current = null;
    }

    resizeCleanupRef.current = handlePointerUp;
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  }

  function handleResizeKeyDown(columnId, event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }

    const column = getColumnDefinition(columns, columnId);

    if (!column) {
      return;
    }

    event.preventDefault();

    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const step = event.shiftKey ? 40 : 12;

    setColumnWidths((currentWidths) =>
      resizeColumnWidths(columns, currentWidths, columnId, direction * step),
    );
  }

  function renderHeaderCell(column) {
    const headerClassNames = [styles.headerCell];

    if (column.align === 'center') {
      headerClassNames.push(styles.centerHeader);
    }

    if (column.maxWidth) {
      headerClassNames.push(styles.fixedWidthColumn);
    }

    return (
      <th
        className={headerClassNames.join(' ')}
        key={column.id}
        style={column.maxWidth ? { maxWidth: `${column.maxWidth}px` } : undefined}
      >
        <span className={styles.headerLabel}>{column.label}</span>
        <button
          className={styles.resizeHandle}
          type="button"
          disabled={column.isResizable === false}
          onPointerDown={(event) => handleResizeStart(column.id, event)}
          onKeyDown={(event) => handleResizeKeyDown(column.id, event)}
          aria-label={`Resize ${column.ariaLabel || column.label} column`}
          aria-orientation="vertical"
          aria-valuemin={column.minWidth}
          aria-valuenow={Math.round(columnWidths[column.id])}
          role="separator"
          title="Resize column"
        />
      </th>
    );
  }

  return (
    <div className={styles.tableScroll} ref={tableScrollRef}>
      <table
        className={styles.table}
        style={{ '--table-width': `${tableWidth}px` }}
      >
        <colgroup>
          {columns.map((column) => (
            <col
              key={column.id}
              style={{
                width: `${columnWidths[column.id]}px`,
                maxWidth: column.maxWidth ? `${column.maxWidth}px` : undefined,
              }}
            />
          ))}
        </colgroup>
        <thead>
          <tr>{columns.map(renderHeaderCell)}</tr>
        </thead>
        {children}
      </table>
    </div>
  );
}

export default ResizableTable;
