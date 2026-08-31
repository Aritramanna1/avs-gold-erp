/** Cross-component keyboard action bus (command palette, cheat sheet, assistant). */
export const KEYBOARD_EVENTS = {
  COMMAND_PALETTE: "ornexa:command-palette",
  CHEAT_SHEET: "ornexa:keyboard-help",
  ASSISTANT_OPEN: "ornexa:assistant-open",
} as const;

export function dispatchKeyboardAction(eventName: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(eventName));
}
