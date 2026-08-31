/**
 * Arrow-key navigation for data tables / voucher lists.
 * Does not steal keys when focus is inside a text field.
 */
import { useCallback, useState, type KeyboardEvent } from "react";

export interface UseTableKeyboardNavOptions {
  rowCount: number;
  onEnter?: (index: number) => void;
  onEscape?: () => void;
  loop?: boolean;
}

export function useTableKeyboardNav(options: UseTableKeyboardNavOptions) {
  const { rowCount, onEnter, onEscape, loop = true } = options;
  const [focusedIndex, setFocusedIndex] = useState(0);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target?.isContentEditable
      ) {
        return;
      }
      if (rowCount <= 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((i) => {
          const next = i + 1;
          if (next >= rowCount) return loop ? 0 : rowCount - 1;
          return next;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((i) => {
          const next = i - 1;
          if (next < 0) return loop ? rowCount - 1 : 0;
          return next;
        });
      } else if (e.key === "Enter") {
        e.preventDefault();
        onEnter?.(Math.min(focusedIndex, rowCount - 1));
      } else if (e.key === "Escape") {
        onEscape?.();
      } else if (e.key === "Home") {
        e.preventDefault();
        setFocusedIndex(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setFocusedIndex(rowCount - 1);
      }
    },
    [rowCount, onEnter, onEscape, loop, focusedIndex],
  );

  return { focusedIndex, setFocusedIndex, onKeyDown };
}
