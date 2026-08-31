import { useEffect, useRef } from "react";
import { useShortcutsStore } from "@/lib/shortcuts-store";
import { comboFromKeyboardEvent, isProtectedBrowserCombo } from "@/lib/keyboard/normalize-combo";
import { normalizeKeyCombo } from "@/lib/keyboard/normalize-combo";

/**
 * Bind a configurable shortcut from the store to a module callback.
 * All hotkeys are user-rebindable via /control/shortcuts.
 */
export function useShortcutBinding(
  shortcutId: string,
  callback: (e: KeyboardEvent) => void,
  options?: { enabled?: boolean; allowInInputs?: boolean },
): string | null {
  const shortcut = useShortcutsStore((s) => s.shortcuts.find((x) => x.id === shortcutId));
  const keys = shortcut ? shortcut.customKeys || shortcut.defaultKeys : null;
  const enabled = options?.enabled !== false;
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!keys || !enabled) return;

    function onKeyDown(e: KeyboardEvent) {
      if (isProtectedBrowserCombo(e)) return;

      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.tagName === "SELECT");

      if (isInput && !options?.allowInInputs) {
        const mod = e.ctrlKey || e.metaKey || e.altKey;
        if (!mod) return;
      }

      if (!keys || normalizeKeyCombo(keys) !== comboFromKeyboardEvent(e)) return;
      e.preventDefault();
      callbackRef.current(e);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [keys, enabled, options?.allowInInputs]);

  return keys;
}

/** Bind multiple shortcut ids to the same handler (e.g. Ctrl+J and Ctrl+Shift+A). */
export function useShortcutBindings(
  shortcutIds: string[],
  callback: (e: KeyboardEvent) => void,
  options?: { enabled?: boolean; allowInInputs?: boolean },
): void {
  const shortcuts = useShortcutsStore((s) => s.shortcuts);
  const keysList = shortcutIds
    .map((id) => shortcuts.find((x) => x.id === id))
    .filter(Boolean)
    .map((s) => normalizeKeyCombo(s!.customKeys || s!.defaultKeys));
  const enabled = options?.enabled !== false;
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!keysList.length || !enabled) return;

    function onKeyDown(e: KeyboardEvent) {
      if (isProtectedBrowserCombo(e)) return;
      const pressed = comboFromKeyboardEvent(e);
      if (!pressed || !keysList.includes(pressed)) return;

      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.tagName === "SELECT");
      if (isInput && !options?.allowInInputs) {
        const mod = e.ctrlKey || e.metaKey || e.altKey;
        if (!mod) return;
      }

      e.preventDefault();
      callbackRef.current(e);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [keysList.join("|"), enabled, options?.allowInInputs]);
}
