import { app, BrowserWindow, dialog, ipcMain, Notification, session, shell } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { IPC } from "./ipc-channels";
import { loadWindowState, trackWindowState } from "./window-state";
import {
  setToken as wasenderSetToken,
  clearToken as wasenderClearToken,
  hasToken as wasenderHasToken,
  setApiKey as wasenderSetApiKey,
  clearApiKey as wasenderClearApiKey,
  hasApiKey as wasenderHasApiKey,
  wasenderRequest,
  type WasenderRequestArgs,
} from "./wasender";

// CommonJS output (see electron/tsconfig.json + dist-electron/package.json's
// {"type":"commonjs"} override) — __dirname is a real CommonJS global here,
// not something we need to reconstruct from import.meta.url.
const isDev = !app.isPackaged;
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
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

function createWindow(): BrowserWindow {
  const state = loadWindowState(app.getPath("userData"));
  const win = new BrowserWindow({
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
    icon: path.join(__dirname, "../build/icon.ico"),
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
    // Production build handles financial/gold-inventory data — DevTools
    // gives console access to the renderer's in-memory state (Zustand
    // stores, Supabase session) and the ability to run arbitrary JS against
    // it, so it's blocked outright rather than just left off the default
    // menu (which a user could still reach via the Ctrl+Shift+I/F12 shortcut
    // Electron wires up automatically regardless of the menu).
    win.webContents.on("devtools-opened", () => win.webContents.closeDevTools());
    win.webContents.on("before-input-event", (event, input) => {
      const key = input.key.toLowerCase();
      if (input.type !== "keyDown") return;
      if (key === "f12" || (input.control && input.shift && key === "i")) {
        event.preventDefault();
      }
    });
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

  ipcMain.handle(IPC.PRINT_LIST_PRINTERS, async () => {
    if (!mainWindow) return [];
    return mainWindow.webContents.getPrintersAsync();
  });

  // ── WasenderAPI (WhatsApp) — token stays here, encrypted; never in renderer ──
  ipcMain.handle(IPC.WASENDER_SET_TOKEN, (_e, token: string) => wasenderSetToken(token));
  ipcMain.handle(IPC.WASENDER_CLEAR_TOKEN, () => wasenderClearToken());
  ipcMain.handle(IPC.WASENDER_HAS_TOKEN, () => wasenderHasToken());
  ipcMain.handle(IPC.WASENDER_SET_APIKEY, (_e, key: string) => wasenderSetApiKey(key));
  ipcMain.handle(IPC.WASENDER_CLEAR_APIKEY, () => wasenderClearApiKey());
  ipcMain.handle(IPC.WASENDER_HAS_APIKEY, () => wasenderHasApiKey());
  ipcMain.handle(IPC.WASENDER_REQUEST, (_e, args: WasenderRequestArgs) => wasenderRequest(args));

  /**
   * Loads print HTML into `win` from a temp file, and deletes the file once the
   * window is done with it.
   *
   * Not a `data:text/html` URL: a printable document embeds its images as
   * base64 (a KYC scan, a hallmark certificate, a design photo on a job card),
   * which pushes the HTML into the megabytes — well past what Chromium accepts
   * for a top-level data: navigation. It would fail as a did-fail-load, i.e. a
   * document that prints fine with no photo and silently refuses to print with
   * one. A file:// URL has no such ceiling.
   */
  const loadPrintHtml = async (win: BrowserWindow, html: string): Promise<void> => {
    const htmlPath = path.join(
      app.getPath("temp"),
      `mtj-print-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.html`,
    );
    await fs.writeFile(htmlPath, html, "utf-8");
    win.on("closed", () => void fs.unlink(htmlPath).catch(() => {}));
    await win.loadURL(pathToFileURL(htmlPath).href);
  };

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
        void loadPrintHtml(printWindow, args.html).catch((err) => {
          printWindow.destroy();
          resolve({ success: false, error: err instanceof Error ? err.message : String(err) });
        });
      }),
  );

  // Print preview. The Windows system print dialog has no preview pane, and
  // Electron ships without Chromium's print-preview UI, so window.print()
  // alone gives the user no way to see the page before it hits paper.
  // Instead: render the document HTML off-screen, printToPDF it, and open
  // that PDF in Chromium's built-in PDF viewer. The user sees the exact
  // document, then prints from the viewer — so what is previewed and what is
  // printed are byte-for-byte the same PDF, not two separate renders.
  ipcMain.handle(
    IPC.PRINT_PREVIEW_HTML,
    (_event, args: { html: string; title?: string; landscape?: boolean }) =>
      new Promise<{ success: boolean; error?: string }>((resolve) => {
        const renderWindow = new BrowserWindow({
          show: false,
          webPreferences: { sandbox: true },
        });

        renderWindow.webContents.once("did-finish-load", async () => {
          try {
            const pdf = await renderWindow.webContents.printToPDF({
              printBackground: true,
              landscape: args.landscape ?? false,
              // Page size and margins come from the document's own @page rules
              // (see PrintLayout.tsx), which printToPDF honours — hardcoding
              // them here would silently override the per-document sizes
              // (A4/A5/thermal/tag).
              preferCSSPageSize: true,
            });
            renderWindow.destroy();

            const pdfPath = path.join(app.getPath("temp"), `mtj-print-${Date.now()}.pdf`);
            await fs.writeFile(pdfPath, pdf);

            const previewWindow = new BrowserWindow({
              width: 900,
              height: 1000,
              title: args.title ?? "Print Preview",
              webPreferences: { plugins: true },
            });
            previewWindow.setMenuBarVisibility(false);
            void previewWindow.loadURL(pathToFileURL(pdfPath).href);
            previewWindow.on("closed", () => {
              void fs.unlink(pdfPath).catch(() => {});
            });
            resolve({ success: true });
          } catch (err) {
            renderWindow.destroy();
            resolve({ success: false, error: err instanceof Error ? err.message : String(err) });
          }
        });

        renderWindow.webContents.once("did-fail-load", (_e, _code, description) => {
          renderWindow.destroy();
          resolve({ success: false, error: description });
        });

        void loadPrintHtml(renderWindow, args.html).catch((err) => {
          renderWindow.destroy();
          resolve({ success: false, error: err instanceof Error ? err.message : String(err) });
        });
      }),
  );
}

// DORMANT — see DEEP_LINK_PROTOCOL comment above. Focuses the window on any
// avsgolderp:// open; the "deep-link" event it sends has no listener today.
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
    // Electron denies every permission request by default unless a handler
    // explicitly grants it — this was the actual reason the barcode camera
    // scanner silently never showed a video feed or a real "denied"
    // message: the getUserMedia() call itself was correct, but Electron
    // never let the request reach the OS/user permission prompt at all.
    // Only "media" (camera/mic) is granted here; every other permission
    // type keeps Electron's default deny.
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
      callback(permission === "media");
    });

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
