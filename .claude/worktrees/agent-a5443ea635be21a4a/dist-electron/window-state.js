"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadWindowState = loadWindowState;
exports.trackWindowState = trackWindowState;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const DEFAULT_STATE = { x: 0, y: 0, width: 1440, height: 900, isMaximized: false };
function statePath(userDataDir) {
    return node_path_1.default.join(userDataDir, "window-state.json");
}
function loadWindowState(userDataDir) {
    try {
        const raw = node_fs_1.default.readFileSync(statePath(userDataDir), "utf-8");
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_STATE, ...parsed };
    }
    catch {
        return { ...DEFAULT_STATE };
    }
}
/** Persists position/size/maximized-state on resize/move/close, debounced so a drag doesn't hammer disk I/O. */
function trackWindowState(win, userDataDir) {
    let saveTimer = null;
    const save = () => {
        if (win.isDestroyed())
            return;
        const bounds = win.getBounds();
        const state = { ...bounds, isMaximized: win.isMaximized() };
        try {
            node_fs_1.default.mkdirSync(userDataDir, { recursive: true });
            node_fs_1.default.writeFileSync(statePath(userDataDir), JSON.stringify(state, null, 2));
        }
        catch {
            // Best-effort persistence — losing window position across restarts is
            // a cosmetic regression, never worth crashing the app over.
        }
    };
    const scheduleSave = () => {
        if (saveTimer)
            clearTimeout(saveTimer);
        saveTimer = setTimeout(save, 500);
    };
    win.on("resize", scheduleSave);
    win.on("move", scheduleSave);
    win.on("close", save);
}
