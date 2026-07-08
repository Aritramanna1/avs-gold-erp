import fs from "node:fs";
import path from "node:path";
import type { BrowserWindow, Rectangle } from "electron";

interface WindowState extends Rectangle {
  isMaximized: boolean;
}

const DEFAULT_STATE: WindowState = { x: 0, y: 0, width: 1440, height: 900, isMaximized: false };

function statePath(userDataDir: string): string {
  return path.join(userDataDir, "window-state.json");
}

export function loadWindowState(userDataDir: string): WindowState {
  try {
    const raw = fs.readFileSync(statePath(userDataDir), "utf-8");
    const parsed = JSON.parse(raw) as Partial<WindowState>;
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

/** Persists position/size/maximized-state on resize/move/close, debounced so a drag doesn't hammer disk I/O. */
export function trackWindowState(win: BrowserWindow, userDataDir: string): void {
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  const save = () => {
    if (win.isDestroyed()) return;
    const bounds = win.getBounds();
    const state: WindowState = { ...bounds, isMaximized: win.isMaximized() };
    try {
      fs.mkdirSync(userDataDir, { recursive: true });
      fs.writeFileSync(statePath(userDataDir), JSON.stringify(state, null, 2));
    } catch {
      // Best-effort persistence — losing window position across restarts is
      // a cosmetic regression, never worth crashing the app over.
    }
  };

  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 500);
  };

  win.on("resize", scheduleSave);
  win.on("move", scheduleSave);
  win.on("close", save);
}
