import { useShortcutsStore } from "@/lib/shortcuts-store";
import { normalizeKeyCombo, comboFromKeyboardEvent } from "@/lib/keyboard/normalize-combo";

export function getShortcutCombo(shortcutId: string): string | null {
  const s = useShortcutsStore.getState().shortcuts.find((x) => x.id === shortcutId);
  if (!s) return null;
  return s.customKeys || s.defaultKeys;
}

export function getShortcutDisplayLabel(shortcutId: string, fallback = ""): string {
  return getShortcutCombo(shortcutId) ?? fallback;
}

export function shortcutMatchesEvent(shortcutId: string, e: KeyboardEvent): boolean {
  const combo = getShortcutCombo(shortcutId);
  if (!combo) return false;
  return normalizeKeyCombo(combo) === comboFromKeyboardEvent(e);
}
