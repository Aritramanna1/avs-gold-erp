import { useEffect } from "react";

/**
 * Ctrl+S saves the currently open dialog/form (Priority 3 "reduce clicks" +
 * Priority 4 keyboard-first). Scoped to `enabled` (typically the dialog's
 * own `open` state) so it never fires for a form that isn't actually on
 * screen, and never conflicts with a DIFFERENT open dialog elsewhere in the
 * app — only one form should be "active" at a time in practice.
 *
 * Always calls preventDefault() on the browser's native Ctrl+S (save-page)
 * behavior while enabled — this is exactly the kind of override the
 * printing/keyboard requirements call for, and is safe: a save-page dialog
 * popping up over a half-filled ERP form would be actively harmful, not a
 * neutral default to preserve.
 */
export function useSaveShortcut(onSave: () => void, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        onSave();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onSave, enabled]);
}
