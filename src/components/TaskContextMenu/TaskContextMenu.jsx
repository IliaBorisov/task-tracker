import { Pencil, Trash2 } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import styles from './TaskContextMenu.module.css';

function TaskContextMenu({ x, y, onClose, onDelete, onEdit }) {
  const menuRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const [position, setPosition] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useLayoutEffect(() => {
    function updatePosition() {
      const menuBounds = menuRef.current.getBoundingClientRect();
      const viewportMargin = 8;

      setPosition({
        left: Math.max(viewportMargin, Math.min(x, window.innerWidth - menuBounds.width - viewportMargin)),
        top: Math.max(viewportMargin, Math.min(y, window.innerHeight - menuBounds.height - viewportMargin)),
      });
    }

    updatePosition();
    window.addEventListener('resize', updatePosition);

    return () => window.removeEventListener('resize', updatePosition);
  }, [x, y]);

  useLayoutEffect(() => {
    const menuElement = menuRef.current;
    const previousFocus = document.activeElement;
    const menuItems = Array.from(menuElement.querySelectorAll('[role="menuitem"]'));

    menuItems[0]?.focus({ preventScroll: true });

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (!menuElement.contains(document.activeElement) ||
        !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        return;
      }

      event.preventDefault();
      const currentIndex = menuItems.indexOf(document.activeElement);
      let nextIndex;

      if (event.key === 'Home') {
        nextIndex = 0;
      } else if (event.key === 'End') {
        nextIndex = menuItems.length - 1;
      } else {
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        nextIndex = (currentIndex + direction + menuItems.length) % menuItems.length;
      }

      menuItems[nextIndex]?.focus({ preventScroll: true });
    }

    function handlePointerDown() {
      onCloseRef.current();
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);

      if (menuElement.contains(document.activeElement) && previousFocus?.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, []);

  return (
    <div
      className={styles.menu}
      ref={menuRef}
      style={position}
      role="menu"
      aria-label="Task actions"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button className={styles.menuItem} type="button" role="menuitem" onClick={onEdit}>
        <Pencil size={16} aria-hidden="true" />
        <span>Edit</span>
      </button>
      <button
        className={`${styles.menuItem} ${styles.dangerItem}`}
        type="button"
        role="menuitem"
        onClick={onDelete}
      >
        <Trash2 size={16} aria-hidden="true" />
        <span>Delete</span>
      </button>
    </div>
  );
}

export default TaskContextMenu;
