"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
const ipc_channels_1 = require("./ipc-channels");
const window_state_1 = require("./window-state");
const registry_1 = require("./hardware/registry");
const mock_driver_1 = require("./hardware/drivers/mock-driver");
// CommonJS output (see electron/tsconfig.json + dist-electron/package.json's
// {"type":"commonjs"} override) — __dirname is a real CommonJS global here,
// not something we need to reconstruct from import.meta.url.
const isDev = !electron_1.app.isPackaged;
const DEEP_LINK_PROTOCOL = "mtjerp";
// ---- Single instance lock ----
// A second launch (e.g. double-clicking a deep link) should focus the
// existing window instead of opening a second, conflicting instance against
// the same encrypted local database.
const gotLock = electron_1.app.requestSingleInstanceLock();
if (!gotLock) {
    electron_1.app.quit();
}
let mainWindow = null;
const hardware = new registry_1.HardwareRegistry();
function registerDevHardware() {
    // Bundled mock devices so the renderer's Hardware Manager UI and IPC
    // surface can be developed/validated without physical devices attached.
    // Real installs register real drivers here instead (one per detected
    // device), never both at once.
    hardware.register(new mock_driver_1.MockDriver("mock-scanner-1", "barcode-scanner", "Mock Barcode Scanner"));
    hardware.register(new mock_driver_1.MockDriver("mock-scale-1", "weighing-scale", "Mock Weighing Scale"));
    hardware.register(new mock_driver_1.MockDriver("mock-thermal-1", "thermal-printer", "Mock Thermal Printer"));
}
function createWindow() {
    const state = (0, window_state_1.loadWindowState)(electron_1.app.getPath("userData"));
    const win = new electron_1.BrowserWindow({
        x: state.x,
        y: state.y,
        width: state.width,
        height: state.height,
        show: false,
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
    electron_1.ipcMain.handle(ipc_channels_1.IPC.HARDWARE_LIST_DEVICES, () => hardware.list());
    electron_1.ipcMain.handle(ipc_channels_1.IPC.HARDWARE_CONNECT, (_event, id) => hardware.connect(id));
    electron_1.ipcMain.handle(ipc_channels_1.IPC.HARDWARE_DISCONNECT, (_event, id) => hardware.disconnect(id));
    electron_1.ipcMain.handle(ipc_channels_1.IPC.HARDWARE_SEND_COMMAND, (_event, args) => hardware.sendCommand(args.id, args.command, args.commandArgs));
    hardware.onAnyEvent((event) => {
        mainWindow?.webContents.send(ipc_channels_1.IPC.HARDWARE_EVENT, event);
    });
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
        registerDevHardware();
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
