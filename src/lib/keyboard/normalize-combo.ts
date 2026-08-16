/** Normalize shortcut combos for reliable matching across OS and casing. */
const KEY_ALIASES: Record<string, string> = {
  ArrowLeft: "LEFT",
  ArrowRight: "RIGHT",
  ArrowUp: "UP",
  ArrowDown: "DOWN",
};

export function normalizeKeyCombo(combo: string): string {
  return combo
    .split("+")
    .map((part) => {
      const p = part.trim();
      const lower = p.toLowerCase();
      if (lower === "ctrl" || lower === "cmd" || lower === "control" || lower === "meta") {
        return "MOD";
      }
      if (lower === "alt" || lower === "option") return "ALT";
      if (lower === "shift") return "SHIFT";
      if (p === ",") return ",";
      if (p === "/") return "/";
      const aliased = KEY_ALIASES[p] ?? KEY_ALIASES[p.toUpperCase()];
      if (aliased) return aliased;
      if (p.length === 1) return p.toUpperCase();
      return p.toUpperCase();
    })
    .join("+");
}

export function comboFromKeyboardEvent(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("MOD");
  if (e.altKey) parts.push("ALT");
  if (e.shiftKey) parts.push("SHIFT");

  const key = e.key;
  if (["Control", "Alt", "Shift", "Meta"].includes(key)) return "";

  if (key === ",") parts.push(",");
  else if (key === "/") parts.push("/");
  else if (KEY_ALIASES[key]) parts.push(KEY_ALIASES[key]);
  else if (key.length === 1) parts.push(key.toUpperCase());
  else parts.push(key.toUpperCase());

  return parts.join("+");
}

/** Block browser-critical combos from being overridden. */
export function isProtectedBrowserCombo(e: KeyboardEvent): boolean {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return false;
  const k = e.key.toLowerCase();
  if (e.shiftKey && (k === "i" || k === "j" || k === "c")) return true;
  return ["t", "w", "r", "l", "n"].includes(k) && !e.altKey;
}
