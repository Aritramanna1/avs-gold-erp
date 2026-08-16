import { useEffect } from "react";
import { useShortcutsStore } from "@/lib/shortcuts-store";
import { useShortcutBinding } from "@/lib/keyboard/use-shortcut-binding";

/**
 * Configurable Ctrl+S (or user-rebound) save shortcut for forms and dialogs.
 */
export function useSaveShortcut(onSave: () => void, enabled: boolean): void {
  useShortcutBinding("form_save", () => onSave(), { enabled, allowInInputs: true });
}
