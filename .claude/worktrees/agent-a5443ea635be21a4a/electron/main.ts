import { app, BrowserWindow, dialog, ipcMain, Notification, shell } from "electron";
import path from "node:path";
import { IPC } from "./ipc-channels";
import { loadWindowState, trackWindowState } from "./window-state";
import { HardwareRegistry } from "./hardware/registry";
import { MockDriver } from "./hardware/drivers/mock-driver";

// CommonJS output (see electron/tsconfig.json + dist-electron/package.json's
// {"type":"commonjs"} override) — __dirname is a real CommonJS global here,
// not something we need to reconstruct from import.meta.url.
const isDev = !app.isPackaged;
const DEEP_LINK_PROTOCOL = "mtjerp";

// ---- Single instance lock ----
// A second launch (e.g. double-clicking a deep link) should focus the
// existing window instead of opening a second, conflicting instance against
// the same encrypted local database.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
const hardware = new HardwareRegistry();

function registerDevHardware(): void {
  // Bundled mock devices so the renderer's Hardware Manager UI and IPC
  // surface can be developed/validated without physical devices attached.
  // Real installs register real drivers here instead (one per detected
  // device), never both at once.
  hardware.register(new MockDriver("mock-scanner-1", "barcode-scanner", "Mock Barcode Scanner"));
  hardware.register(new MockDriver("mock-scale-1", "weighing-scale", "Mock Weighing Scale"));
  hardware.register(new MockDriver("mock-thermal-1", "thermal-printer", "Mock Thermal Printer"));
}

function createWindow(): BrowserWindow {
  const state = loadWindowState(app.getPath("userData"));
  const win = new BrowserWindow({
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
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (state.isMaximized) win.maximize();

  win.once("ready-to-show", () => win.show());

  // Any window.open()/target=_blank from renderer content opens in the OS
  // browser instead of a new uncontrolled Electron window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  trackWindowState(win, app.getPath("userData"));

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  return win;
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC.APP_GET_VERSION, () => app.getVersion());

  ipcMain.handle(IPC.APP_RELAUNCH, () => {
    app.relaunch();
    app.exit(0);
  });

  ipcMain.handle(IPC.DIALOG_OPEN_FILE, async (_event, options: Electron.OpenDialogOptions = {}) => {
    if (!mainWindow) return { canceled: true, filePaths: [] };
    return dialog.showOpenDialog(mainWindow, options);
  });

  ipcMain.handle(IPC.DIALOG_SAVE_FILE, async (_event, options: Electron.SaveDialogOptions = {}) => {
    if (!mainWindow) return { canceled: true, filePath: undefined };
    return dialog.showSaveDialog(mainWindow, options);
  });

  ipcMain.handle(IPC.NOTIFY_SHOW, (_event, args: { title: string; body?: string }) => {
    if (!Notification.isSupported()) return { shown: false };
    new Notification({ title: args.title, body: args.body }).show();
    return { shown: true };
  });

  ipcMain.on(IPC.WINDOW_MINIMIZE, () => mainWindow?.minimize());
  ipcMain.on(IPC.WINDOW_MAXIMIZE_TOGGLE, () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.on(IPC.WINDOW_CLOSE, () => mainWindow?.close());

  ipcMain.handle(IPC.HARDWARE_LIST_DEVICES, () => hardware.list());
  ipcMain.handle(IPC.HARDWARE_CONNECT, (_event, id: string) => hardware.connect(id));
  ipcMain.handle(IPC.HARDWARE_DISCONNECT, (_event, id: string) => hardware.disconnect(id));
  ipcMain.handle(
    IPC.HARDWARE_SEND_COMMAND,
    (_event, args: { id: string; command: string; commandArgs?: unknown }) =>
      hardware.sendCommand(args.id, args.command, args.commandArgs),
  );

  hardware.onAnyEvent((event) => {
    mainWindow?.webContents.send(IPC.HARDWARE_EVENT, event);
  });

  ipcMain.handle(IPC.PRINT_LIST_PRINTERS, async () => {
    if (!mainWindow) return [];
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
  ipcMain.handle(
    IPC.PRINT_HTML,
    (
      _event,
      args: {
        html: string;
        silent?: boolean;
        printerName?: string;
        landscape?: boolean;
        marginsMm?: { top: number; bottom: number; left: number; right: number };
      },
    ) =>
      new Promise<{ success: boolean; error?: string }>((resolve) => {
        const printWindow = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
        printWindow.webContents.once("did-finish-load", () => {
          printWindow.webContents.print(
            {
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
            },
            (success, failureReason) => {
              printWindow.destroy();
              resolve({ success, error: success ? undefined : failureReason });
            },
          );
        });
        printWindow.webContents.once("did-fail-load", (_e, _code, description) => {
          printWindow.destroy();
          resolve({ success: false, error: description });
        });
        printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(args.html)}`);
      }),
  );
}

function handleDeepLink(url: string): void {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
  mainWindow.webContents.send("deep-link", url);
}

if (gotLock) {
  app.on("second-instance", (_event, argv) => {
    const deepLink = argv.find((arg) => arg.startsWith(`${DEEP_LINK_PROTOCOL}://`));
    if (deepLink) handleDeepLink(deepLink);
    else if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  if (!app.isDefaultProtocolClient(DEEP_LINK_PROTOCOL)) {
    app.setAsDefaultProtocolClient(DEEP_LINK_PROTOCOL);
  }

  app.on("open-url", (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
  });

  // Crash recovery: an unexpected renderer crash reloads the same window
  // rather than leaving the user staring at a blank/frozen app. A clean exit
  // (navigation, user-initiated close) never reaches this path.
  app.whenReady().then(() => {
    registerDevHardware();
    registerIpcHandlers();
    mainWindow = createWindow();

    mainWindow.webContents.on("render-process-gone", (_event, details) => {
      if (details.reason === "clean-exit") return;
      mainWindow?.destroy();
      mainWindow = createWindow();
    });

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
