import { app, BrowserWindow, dialog, ipcMain, Menu, Notification, session, shell } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { IPC } from "./ipc-channels";
import type { IpcChannel } from "./ipc-channels";
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
import { secureStoreDelete, secureStoreGet, secureStoreSet } from "./secure-store";
import {
  installMainProcessErrorHandlers,
  logMainError,
  type MainProcessErrorReport,
} from "./error-handling";

installMainProcessErrorHandlers();

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
const MAX_PRINT_HTML_BYTES = 25 * 1024 * 1024;

function validatePrintHtml(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("Printable HTML is required.");
  if (Buffer.byteLength(value, "utf8") > MAX_PRINT_HTML_BYTES) {
    throw new Error("Printable document exceeds the 25 MB safety limit.");
  }
  const policy =
    "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; img-src data: blob: file: https: http:; style-src 'unsafe-inline'; font-src data:;\">";
  return /<head(?:\s[^>]*)?>/i.test(value)
    ? value.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}${policy}`)
    : `${policy}${value}`;
}

function hardenAuxiliaryWindow(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    const current = win.webContents.getURL();
    if (current && current !== url) event.preventDefault();
  });
}

function validateRendererErrorReport(payload: unknown): MainProcessErrorReport {
  if (!payload || typeof payload !== "object") throw new Error("Invalid diagnostics report.");
  const value = payload as Record<string, unknown>;
  const text = (key: string, max: number): string =>
    typeof value[key] === "string" ? String(value[key]).slice(0, max) : "";
  const id = text("id", 80);
  const technicalMessage = text("technicalMessage", 4_000);
  if (!id || !technicalMessage) throw new Error("Incomplete diagnostics report.");
  return {
    id,
    title: text("title", 200) || "Application error",
    message: text("message", 1_000),
    guidance: text("guidance", 1_000),
    category: text("category", 80),
    severity: text("severity", 40),
    technicalMessage,
    stack: text("stack", 12_000) || undefined,
    context: text("context", 200) || undefined,
    timestamp: text("timestamp", 80) || new Date().toISOString(),
    recoverable: value.recoverable !== false,
  };
}

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
      devTools: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (state.isMaximized) win.maximize();

  win.once("ready-to-show", () => {
    win.show();
    // Dev-only startup timing — process start → window visible.
    if (!app.isPackaged) {
      console.log(`[startup] window shown +${Math.round(process.uptime() * 1000)}ms`);
    }
  });

  win.webContents.on("did-fail-load", (_event, code, description, validatedUrl) => {
    logMainError(
      new Error(`Window failed to load ${validatedUrl}: ${code} ${description}`),
      "browser-window.did-fail-load",
    );
  });

  win.webContents.on("unresponsive", () => {
    logMainError(new Error("Main window became unresponsive."), "browser-window.unresponsive");
  });

  win.webContents.on("responsive", () => {
    if (!app.isPackaged) console.log("[desktop] main window responsive");
  });

  // Any window.open()/target=_blank from renderer content opens in the OS
  // browser instead of a new uncontrolled Electron window. Only explicit
  // public web/contact schemes may reach the operating-system shell.
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const protocol = new URL(url).protocol;
      if (protocol === "https:" || protocol === "mailto:" || protocol === "tel:") {
        void shell.openExternal(url);
      }
    } catch {
      // Invalid and relative URLs stay inside the application boundary.
    }
    return { action: "deny" };
  });

  // Do not let renderer content replace the trusted app document with a
  // remote page that would inherit this window's preload bridge.
  win.webContents.on("will-navigate", (event, url) => {
    const currentUrl = win.webContents.getURL();
    if (currentUrl && url !== currentUrl) event.preventDefault();
  });

  trackWindowState(win, app.getPath("userData"));

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  // Version 1 testing builds expose no Chromium developer surface in any
  // environment. devTools:false is the primary control; this also suppresses
  // the familiar shortcuts before Electron can route them.
  win.webContents.on("before-input-event", (event, input) => {
    const key = input.key.toLowerCase();
    if (
      input.type === "keyDown" &&
      (key === "f12" || (input.control && input.shift && key === "i"))
    ) {
      event.preventDefault();
    }
  });

  return win;
}

function registerIpcHandlers(): void {
  const assertTrustedSender = (
    event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent,
  ): void => {
    if (!mainWindow || event.sender !== mainWindow.webContents) {
      throw new Error("Rejected IPC request from an untrusted renderer.");
    }
  };
  const handle = (
    channel: IpcChannel,
    listener: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => unknown,
  ): void => {
    ipcMain["handle"](channel, async (event, ...args) => {
      try {
        assertTrustedSender(event);
        return await listener(event, ...args);
      } catch (error) {
        const report = logMainError(error, `ipc.${channel}`);
        throw new Error(`${report.message} Error Reference ID: ${report.id}`);
      }
    });
  };
  const on = (
    channel: IpcChannel,
    listener: (event: Electron.IpcMainEvent, ...args: any[]) => void,
  ): void => {
    ipcMain["on"](channel, (event, ...args) => {
      try {
        assertTrustedSender(event);
        listener(event, ...args);
      } catch (error) {
        logMainError(error, `ipc.${channel}`);
      }
    });
  };

  handle(IPC.APP_GET_VERSION, () => app.getVersion());

  handle(IPC.DIAGNOSTICS_REPORT_ERROR, (_event, payload: MainProcessErrorReport) => {
    const validated = validateRendererErrorReport(payload);
    logMainError(validated, validated.context ?? "renderer.diagnostics");
  });

  handle(IPC.APP_RELAUNCH, () => {
    app.relaunch();
    app.exit(0);
  });

  handle(
    IPC.HYBRID_VALIDATE_SETUP,
    async (
      _event,
      args: { projectUrl: string; anonKey: string; serviceRoleKey: string },
    ): Promise<{ ok: boolean; schemaVersion?: number; error?: string }> => {
      if (
        !args ||
        typeof args.projectUrl !== "string" ||
        typeof args.anonKey !== "string" ||
        typeof args.serviceRoleKey !== "string"
      ) {
        return { ok: false, error: "Invalid Hybrid setup request." };
      }
      const projectUrl = args.projectUrl.trim().replace(/\/$/, "");
      const anonKey = args.anonKey.trim();
      const serviceRoleKey = args.serviceRoleKey.trim();
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(projectUrl);
      } catch {
        return { ok: false, error: "Enter a valid Supabase project URL." };
      }
      const trustedHost = parsedUrl.hostname.endsWith(".supabase.co");
      if (
        parsedUrl.protocol !== "https:" ||
        !trustedHost ||
        parsedUrl.username ||
        parsedUrl.password ||
        parsedUrl.port
      ) {
        return { ok: false, error: "Enter the HTTPS URL for a Supabase-hosted project." };
      }
      if (
        anonKey.length < 20 ||
        serviceRoleKey.length < 20 ||
        anonKey.length > 4_096 ||
        serviceRoleKey.length > 4_096
      ) {
        return { ok: false, error: "Both Supabase keys are required." };
      }

      const request = async (key: string, resource: string) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12_000);
        const headers: Record<string, string> = { apikey: key };
        if (key.split(".").length === 3) headers.Authorization = `Bearer ${key}`;
        try {
          return await fetch(`${parsedUrl.origin}/rest/v1/${resource}`, {
            headers,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }
      };

      try {
        const serviceResponse = await request(serviceRoleKey, "erp_setup_guard?select=id&limit=1");
        if (!serviceResponse.ok) {
          return {
            ok: false,
            error:
              serviceResponse.status === 404
                ? "Master SQL migration is not installed on this project."
                : "Service Role Key validation failed.",
          };
        }
        const anonResponse = await request(
          anonKey,
          "erp_schema_meta?select=id,schema_version&limit=1",
        );
        if (!anonResponse.ok) {
          return { ok: false, error: "Anon Key cannot access the installed ERP schema." };
        }
        const rows = (await anonResponse.json()) as Array<{ schema_version?: number }>;
        if (!rows[0]?.schema_version) {
          return { ok: false, error: "ERP schema metadata is missing. Run the master migration." };
        }
        // The setup-only service key is deliberately discarded here. It is
        // never returned, logged, written to disk, or exposed after this call.
        return { ok: true, schemaVersion: rows[0].schema_version };
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof Error && error.name === "AbortError"
              ? "Supabase validation timed out."
              : "Could not connect to the Supabase project.",
        };
      }
    },
  );

  handle(
    IPC.HYBRID_INITIALIZE_SCHEMA,
    async (
      _event,
      args: { projectUrl: string; anonKey: string; pgConnectionString: string },
    ): Promise<{ ok: boolean; schemaVersion?: number; error?: string }> => {
      if (
        !args ||
        typeof args.projectUrl !== "string" ||
        typeof args.anonKey !== "string" ||
        typeof args.pgConnectionString !== "string"
      ) {
        return { ok: false, error: "Invalid schema initialization request." };
      }
      const projectUrl = args.projectUrl.trim().replace(/\/$/, "");
      const anonKey = args.anonKey.trim();
      const connectionString = args.pgConnectionString.trim();
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(projectUrl);
      } catch {
        return { ok: false, error: "Enter a valid Supabase project URL." };
      }
      if (parsedUrl.protocol !== "https:" || !parsedUrl.hostname.endsWith(".supabase.co")) {
        return { ok: false, error: "Enter the HTTPS URL for a Supabase-hosted project." };
      }
      if (connectionString.length < 20) {
        return { ok: false, error: "Enter the Postgres connection string for this project." };
      }

      const masterSqlPath = app.isPackaged
        ? path.join(process.resourcesPath, "AVS_GOLD_ERP_HYBRID_MASTER.sql")
        : path.join(__dirname, "..", "supabase", "AVS_GOLD_ERP_HYBRID_MASTER.sql");

      let masterSql: string;
      try {
        masterSql = await fs.readFile(masterSqlPath, "utf8");
      } catch {
        return { ok: false, error: "Bundled master SQL migration file is missing." };
      }

      // Local require keeps `pg` out of the renderer bundle; connection
      // string never leaves this handler — not logged, stored, or returned.
      const { Client } = await import("pg");

      let targetDb = "postgres";
      try {
        const parsedPgUrl = new URL(connectionString);
        targetDb = parsedPgUrl.pathname.slice(1) || "postgres";
      } catch {
        // Fallback if not a valid URL (e.g. key=value style connection string)
      }

      if (targetDb !== "postgres") {
        // Connect to the default 'postgres' database first to create the target database if it doesn't exist
        try {
          const defaultPgUrl = new URL(connectionString);
          defaultPgUrl.pathname = "/postgres";
          const adminClient = new Client({
            connectionString: defaultPgUrl.toString(),
            ssl: { rejectUnauthorized: false },
          });
          await adminClient.connect();
          const checkRes = await adminClient.query("SELECT 1 FROM pg_database WHERE datname = $1", [
            targetDb,
          ]);
          if (checkRes.rowCount === 0) {
            // CREATE DATABASE cannot run inside a transaction or parameterized query
            await adminClient.query(`CREATE DATABASE "${targetDb.replace(/"/g, '""')}"`);
          }
          await adminClient.end().catch(() => {});
        } catch (error) {
          // If we fail to create the database (e.g., lack of privileges, or connection string not a URL),
          // we still attempt to connect to the target database directly below in case it already exists.
        }
      }

      const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
      try {
        await client.connect();
        // Master SQL is authored with IF NOT EXISTS / OR REPLACE / ON
        // CONFLICT guards throughout, so re-running it is idempotent both
        // for a brand-new database and for a schema needing an upgrade.
        await client.query(masterSql);
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof Error
              ? `Master SQL migration failed: ${error.message}`
              : "Master SQL migration failed.",
        };
      } finally {
        await client.end().catch(() => {});
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12_000);
        const headers: Record<string, string> = { apikey: anonKey };
        if (anonKey.split(".").length === 3) headers.Authorization = `Bearer ${anonKey}`;
        let verifyResponse: Response;
        try {
          verifyResponse = await fetch(
            `${parsedUrl.origin}/rest/v1/erp_schema_meta?select=id,schema_version&limit=1`,
            { headers, signal: controller.signal },
          );
        } finally {
          clearTimeout(timeout);
        }
        if (!verifyResponse.ok) {
          return { ok: false, error: "Migration ran, but post-migration verification failed." };
        }
        const rows = (await verifyResponse.json()) as Array<{ schema_version?: number }>;
        if (!rows[0]?.schema_version) {
          return { ok: false, error: "Migration ran, but schema_version was not recorded." };
        }
        return { ok: true, schemaVersion: rows[0].schema_version };
      } catch {
        return { ok: false, error: "Migration ran, but post-migration verification failed." };
      }
    },
  );

  handle(IPC.DIALOG_OPEN_FILE, async (_event, options: Electron.OpenDialogOptions = {}) => {
    if (!mainWindow) return { canceled: true, filePaths: [] };
    return dialog.showOpenDialog(mainWindow, options);
  });

  handle(IPC.DIALOG_SAVE_FILE, async (_event, options: Electron.SaveDialogOptions = {}) => {
    if (!mainWindow) return { canceled: true, filePath: undefined };
    return dialog.showSaveDialog(mainWindow, options);
  });

  handle(IPC.NOTIFY_SHOW, (_event, args: { title: string; body?: string }) => {
    if (!args || typeof args.title !== "string" || !args.title.trim()) return { shown: false };
    if (!Notification.isSupported()) return { shown: false };
    new Notification({
      title: args.title.trim().slice(0, 160),
      body: typeof args.body === "string" ? args.body.slice(0, 2_000) : undefined,
    }).show();
    return { shown: true };
  });

  on(IPC.WINDOW_MINIMIZE, () => mainWindow?.minimize());
  on(IPC.WINDOW_MAXIMIZE_TOGGLE, () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  on(IPC.WINDOW_CLOSE, () => mainWindow?.close());

  handle(IPC.PRINT_LIST_PRINTERS, async () => {
    if (!mainWindow) return [];
    return mainWindow.webContents.getPrintersAsync();
  });

  // ── WasenderAPI (WhatsApp) — token stays here, encrypted; never in renderer ──
  handle(IPC.WASENDER_SET_TOKEN, (_e, token: string) => wasenderSetToken(token));
  handle(IPC.WASENDER_CLEAR_TOKEN, () => wasenderClearToken());
  handle(IPC.WASENDER_HAS_TOKEN, () => wasenderHasToken());
  handle(IPC.WASENDER_SET_APIKEY, (_e, key: string) => wasenderSetApiKey(key));
  handle(IPC.WASENDER_CLEAR_APIKEY, () => wasenderClearApiKey());
  handle(IPC.WASENDER_HAS_APIKEY, () => wasenderHasApiKey());
  handle(IPC.WASENDER_REQUEST, (_e, args: WasenderRequestArgs) => wasenderRequest(args));

  handle(IPC.SECURE_STORE_GET, (_event, key: string) => secureStoreGet(key));
  handle(IPC.SECURE_STORE_SET, (_event, key: string, value: string) => secureStoreSet(key, value));
  handle(IPC.SECURE_STORE_DELETE, (_event, key: string) => secureStoreDelete(key));

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
    await fs.writeFile(htmlPath, validatePrintHtml(html), { encoding: "utf-8", mode: 0o600 });
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
  handle(
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
    ) => {
      if (!args || typeof args.html !== "string") {
        return Promise.resolve({ success: false, error: "Invalid print request." });
      }
      return new Promise<{ success: boolean; error?: string }>((resolve) => {
        const printWindow = new BrowserWindow({
          show: false,
          webPreferences: {
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
            devTools: false,
          },
        });
        hardenAuxiliaryWindow(printWindow);
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
      });
    },
  );

  // Print preview. The Windows system print dialog has no preview pane, and
  // Electron ships without Chromium's print-preview UI, so window.print()
  // alone gives the user no way to see the page before it hits paper.
  // Instead: render the document HTML off-screen, printToPDF it, and open
  // that PDF in Chromium's built-in PDF viewer. The user sees the exact
  // document, then prints from the viewer — so what is previewed and what is
  // printed are byte-for-byte the same PDF, not two separate renders.
  handle(
    IPC.PRINT_PREVIEW_HTML,
    (_event, args: { html: string; title?: string; landscape?: boolean }) => {
      if (!args || typeof args.html !== "string") {
        return Promise.resolve({ success: false, error: "Invalid print preview request." });
      }
      return new Promise<{ success: boolean; error?: string }>((resolve) => {
        const renderWindow = new BrowserWindow({
          show: false,
          webPreferences: {
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
            devTools: false,
          },
        });
        hardenAuxiliaryWindow(renderWindow);

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
              webPreferences: {
                plugins: true,
                sandbox: true,
                contextIsolation: true,
                nodeIntegration: false,
                devTools: false,
              },
            });
            hardenAuxiliaryWindow(previewWindow);
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
      });
    },
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

  app.on("child-process-gone", (_event, details) => {
    logMainError(
      new Error(`Electron child process exited: ${details.type} ${details.reason}`),
      "app.child-process-gone",
    );
  });

  // Crash recovery: an unexpected renderer crash reloads the same window
  // rather than leaving the user staring at a blank/frozen app. A clean exit
  // (navigation, user-initiated close) never reaches this path.
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    // Electron denies every permission request by default unless a handler
    // explicitly grants it — this was the actual reason the barcode camera
    // scanner silently never showed a video feed or a real "denied"
    // message: the getUserMedia() call itself was correct, but Electron
    // never let the request reach the OS/user permission prompt at all.
    // Only "media" (camera/mic) is granted here; every other permission
    // type keeps Electron's default deny.
    session.defaultSession.setPermissionRequestHandler(
      (webContents, permission, callback, details) => {
        const fromMainWindow = webContents === mainWindow?.webContents;
        const mediaTypes = "mediaTypes" in details ? details.mediaTypes : [];
        const videoOnly =
          permission === "media" &&
          Array.isArray(mediaTypes) &&
          mediaTypes.includes("video") &&
          !mediaTypes.includes("audio");
        callback(fromMainWindow && videoOnly);
      },
    );

    registerIpcHandlers();
    mainWindow = createWindow();

    mainWindow.webContents.on("render-process-gone", (_event, details) => {
      if (details.reason === "clean-exit") return;
      logMainError(
        new Error(`Renderer process exited unexpectedly: ${details.reason}`),
        "browser-window.render-process-gone",
      );
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
