"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
const ipc_channels_1 = require("./ipc-channels");
const window_state_1 = require("./window-state");
// CommonJS output (see electron/tsconfig.json + dist-electron/package.json's
// {"type":"commonjs"} override) — __dirname is a real CommonJS global here,
// not something we need to reconstruct from import.meta.url.
const isDev = !electron_1.app.isPackaged;
// DORMANT (2026-07-10 architecture audit): protocol is registered and
// `handleDeepLink()` fires a "deep-link" IPC event, but no renderer code
// listens for it — verified zero references to "deep-link"/"avsgolderp" in
// src/. Invitation-accept uses a plain HTTPS route + 6-digit code, not this.
// Kept registered (harmless no-op if a link is ever opened) rather than
// removed, in case a future feature (e.g. "open record from notification")
// wants it — reactivate by adding a `mtjDesktop.deepLink.onLink()` listener
// in the renderer (the preload bridge already exposes it).
const DEEP_LINK_PROTOCOL = "avsgolderp";
// ---- Single instance lock ----
// A second launch (e.g. double-clicking a deep link) should focus the
// existing window instead of opening a second, conflicting instance against
// the same encrypted local database.
const gotLock = electron_1.app.requestSingleInstanceLock();
if (!gotLock) {
    electron_1.app.quit();
}
let mainWindow = null;
function createWindow() {
    const state = (0, window_state_1.loadWindowState)(electron_1.app.getPath("userData"));
    const win = new electron_1.BrowserWindow({
        x: state.x,
        y: state.y,
        width: state.width,
        height: state.height,
        show: false,
        title: "AVS Gold ERP",
        // Packaged builds get the icon baked into the executable by
        // electron-builder (build/icon.ico) automatically; this only matters
        // for `npm run electron:dev`, which would otherwise show Electron's
        // default icon instead of AVS branding.
        icon: node_path_1.default.join(__dirname, "../build/icon.ico"),
        webPreferences: {
            // Security baseline: renderer never gets direct Node access; the ONLY
            // surface it sees is whatever preload.ts explicitly exposes.
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            preload: node_path_1.default.join(__dirname, "preload.js"),
        },
    });
    if (state.isMaximized)
        win.maximize();
    win.once("ready-to-show", () => win.show());
    // Any window.open()/target=_blank from renderer content opens in the OS
    // browser instead of a new uncontrolled Electron window.
    win.webContents.setWindowOpenHandler(({ url }) => {
        electron_1.shell.openExternal(url);
        return { action: "deny" };
    });
    (0, window_state_1.trackWindowState)(win, electron_1.app.getPath("userData"));
    if (isDev && process.env.VITE_DEV_SERVER_URL) {
        win.loadURL(process.env.VITE_DEV_SERVER_URL);
        win.webContents.openDevTools({ mode: "detach" });
    }
    else {
        win.loadFile(node_path_1.default.join(__dirname, "../dist/index.html"));
        // Production build handles financial/gold-inventory data — DevTools
        // gives console access to the renderer's in-memory state (Zustand
        // stores, Supabase session) and the ability to run arbitrary JS against
        // it, so it's blocked outright rather than just left off the default
        // menu (which a user could still reach via the Ctrl+Shift+I/F12 shortcut
        // Electron wires up automatically regardless of the menu).
        win.webContents.on("devtools-opened", () => win.webContents.closeDevTools());
        win.webContents.on("before-input-event", (event, input) => {
            const key = input.key.toLowerCase();
            if (input.type !== "keyDown")
                return;
            if (key === "f12" || (input.control && input.shift && key === "i")) {
                event.preventDefault();
            }
        });
    }
    return win;
}
function registerIpcHandlers() {
    electron_1.ipcMain.handle(ipc_channels_1.IPC.APP_GET_VERSION, () => electron_1.app.getVersion());
    electron_1.ipcMain.handle(ipc_channels_1.IPC.APP_RELAUNCH, () => {
        electron_1.app.relaunch();
        electron_1.app.exit(0);
    });
    electron_1.ipcMain.handle(ipc_channels_1.IPC.DIALOG_OPEN_FILE, async (_event, options = {}) => {
        if (!mainWindow)
            return { canceled: true, filePaths: [] };
        return electron_1.dialog.showOpenDialog(mainWindow, options);
    });
    electron_1.ipcMain.handle(ipc_channels_1.IPC.DIALOG_SAVE_FILE, async (_event, options = {}) => {
        if (!mainWindow)
            return { canceled: true, filePath: undefined };
        return electron_1.dialog.showSaveDialog(mainWindow, options);
    });
    electron_1.ipcMain.handle(ipc_channels_1.IPC.NOTIFY_SHOW, (_event, args) => {
        if (!electron_1.Notification.isSupported())
            return { shown: false };
        new electron_1.Notification({ title: args.title, body: args.body }).show();
        return { shown: true };
    });
    electron_1.ipcMain.on(ipc_channels_1.IPC.WINDOW_MINIMIZE, () => mainWindow?.minimize());
    electron_1.ipcMain.on(ipc_channels_1.IPC.WINDOW_MAXIMIZE_TOGGLE, () => {
        if (!mainWindow)
            return;
        if (mainWindow.isMaximized())
            mainWindow.unmaximize();
        else
            mainWindow.maximize();
    });
    electron_1.ipcMain.on(ipc_channels_1.IPC.WINDOW_CLOSE, () => mainWindow?.close());
    electron_1.ipcMain.handle(ipc_channels_1.IPC.PRINT_LIST_PRINTERS, async () => {
        if (!mainWindow)
            return [];
        return mainWindow.webContents.getPrintersAsync();
    });
    // Renders arbitrary HTML in a hidden, throwaway window and prints it —
    // this is what makes "silent printing" and "printer selection" real
    // rather than just a browser print dialog: Electron can target a named
    // printer and skip the OS print dialog entirely (silent: true), neither
    // of which a plain browser tab can do. Always resolves (never rejects)
    // with a { success, error? } shape so the renderer's print queue can
    // reliably fall back to a PDF on any failure rather than needing to
    // catch a thrown IPC error.
    electron_1.ipcMain.handle(ipc_channels_1.IPC.PRINT_HTML, (_event, args) => new Promise((resolve) => {
        const printWindow = new electron_1.BrowserWindow({ show: false, webPreferences: { sandbox: true } });
        printWindow.webContents.once("did-finish-load", () => {
            printWindow.webContents.print({
                silent: args.silent ?? false,
                deviceName: args.printerName,
                landscape: args.landscape ?? false,
                printBackground: true,
                margins: args.marginsMm
                    ? {
                        marginType: "custom",
                        top: args.marginsMm.top,
                        bottom: args.marginsMm.bottom,
                        left: args.marginsMm.left,
                        right: args.marginsMm.right,
                    }
                    : undefined,
            }, (success, failureReason) => {
                printWindow.destroy();
                resolve({ success, error: success ? undefined : failureReason });
            });
        });
        printWindow.webContents.once("did-fail-load", (_e, _code, description) => {
            printWindow.destroy();
            resolve({ success: false, error: description });
        });
        printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(args.html)}`);
    }));
}
// DORMANT — see DEEP_LINK_PROTOCOL comment above. Focuses the window on any
// avsgolderp:// open; the "deep-link" event it sends has no listener today.
function handleDeepLink(url) {
    if (!mainWindow)
        return;
    if (mainWindow.isMinimized())
        mainWindow.restore();
    mainWindow.focus();
    mainWindow.webContents.send("deep-link", url);
}
if (gotLock) {
    electron_1.app.on("second-instance", (_event, argv) => {
        const deepLink = argv.find((arg) => arg.startsWith(`${DEEP_LINK_PROTOCOL}://`));
        if (deepLink)
            handleDeepLink(deepLink);
        else if (mainWindow) {
            if (mainWindow.isMinimized())
                mainWindow.restore();
            mainWindow.focus();
        }
    });
    if (!electron_1.app.isDefaultProtocolClient(DEEP_LINK_PROTOCOL)) {
        electron_1.app.setAsDefaultProtocolClient(DEEP_LINK_PROTOCOL);
    }
    electron_1.app.on("open-url", (event, url) => {
        event.preventDefault();
        handleDeepLink(url);
    });
    // Crash recovery: an unexpected renderer crash reloads the same window
    // rather than leaving the user staring at a blank/frozen app. A clean exit
    // (navigation, user-initiated close) never reaches this path.
    electron_1.app.whenReady().then(() => {
        // Electron denies every permission request by default unless a handler
        // explicitly grants it — this was the actual reason the barcode camera
        // scanner silently never showed a video feed or a real "denied"
        // message: the getUserMedia() call itself was correct, but Electron
        // never let the request reach the OS/user permission prompt at all.
        // Only "media" (camera/mic) is granted here; every other permission
        // type keeps Electron's default deny.
        electron_1.session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
            callback(permission === "media");
        });
        registerIpcHandlers();
        mainWindow = createWindow();
        mainWindow.webContents.on("render-process-gone", (_event, details) => {
            if (details.reason === "clean-exit")
                return;
            mainWindow?.destroy();
            mainWindow = createWindow();
        });
        electron_1.app.on("activate", () => {
            if (electron_1.BrowserWindow.getAllWindows().length === 0)
                mainWindow = createWindow();
        });
    });
    electron_1.app.on("window-all-closed", () => {
        if (process.platform !== "darwin")
            electron_1.app.quit();
    });
}
