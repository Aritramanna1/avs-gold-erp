import { contextBridge, ipcRenderer } from "electron";
import type { IpcChannel } from "./ipc-channels";

/**
 * The ONLY surface the renderer ever sees of Electron/Node. contextIsolation
 * + sandbox are on in main.ts, so nothing here can be used to reach into
 * Node internals from the page — every call is a narrow, typed round trip
 * through ipcRenderer.invoke/on to a specific handler registered in main.ts.
 *
 * Electron's sandboxed preload loader can only resolve the preload file
 * itself, not arbitrary local `require("./other-file")`s — so this file
 * duplicates the channel string literals from ipc-channels.ts rather than
 * importing the `IPC` value (the `IpcChannel` *type* import above is erased
 * at compile time and does not hit that restriction). Keep this object's
 * values in sync with ipc-channels.ts's IPC object.
 */
const IPC = {
  DIALOG_OPEN_FILE: "dialog:open-file",
  DIALOG_SAVE_FILE: "dialog:save-file",
  NOTIFY_SHOW: "notify:show",
  APP_GET_VERSION: "app:get-version",
  APP_RELAUNCH: "app:relaunch",
  WINDOW_MINIMIZE: "window:minimize",
  WINDOW_MAXIMIZE_TOGGLE: "window:maximize-toggle",
  WINDOW_CLOSE: "window:close",
  PRINT_LIST_PRINTERS: "print:list-printers",
  PRINT_HTML: "print:html",
  PRINT_PREVIEW_HTML: "print:preview-html",
  WASENDER_SET_TOKEN: "wasender:set-token",
  WASENDER_CLEAR_TOKEN: "wasender:clear-token",
  WASENDER_HAS_TOKEN: "wasender:has-token",
  WASENDER_SET_APIKEY: "wasender:set-apikey",
  WASENDER_CLEAR_APIKEY: "wasender:clear-apikey",
  WASENDER_HAS_APIKEY: "wasender:has-apikey",
  WASENDER_REQUEST: "wasender:request",
} as const satisfies Record<string, IpcChannel>;
const api = {
  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke(IPC.APP_GET_VERSION),
    relaunch: (): Promise<void> => ipcRenderer.invoke(IPC.APP_RELAUNCH),
  },
  dialog: {
    openFile: (options?: Electron.OpenDialogOptions) =>
      ipcRenderer.invoke(IPC.DIALOG_OPEN_FILE, options),
    saveFile: (options?: Electron.SaveDialogOptions) =>
      ipcRenderer.invoke(IPC.DIALOG_SAVE_FILE, options),
  },
  notify: {
    show: (title: string, body?: string): Promise<{ shown: boolean }> =>
      ipcRenderer.invoke(IPC.NOTIFY_SHOW, { title, body }),
  },
  window: {
    minimize: () => ipcRenderer.send(IPC.WINDOW_MINIMIZE),
    maximizeToggle: () => ipcRenderer.send(IPC.WINDOW_MAXIMIZE_TOGGLE),
    close: () => ipcRenderer.send(IPC.WINDOW_CLOSE),
  },
  print: {
    listPrinters: (): Promise<Electron.PrinterInfo[]> =>
      ipcRenderer.invoke(IPC.PRINT_LIST_PRINTERS),
    printHtml: (
      html: string,
      options?: {
        silent?: boolean;
        printerName?: string;
        landscape?: boolean;
        marginsMm?: { top: number; bottom: number; left: number; right: number };
      },
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.PRINT_HTML, { html, ...options }),
    /**
     * Renders the document HTML to a PDF and opens it in Chromium's PDF
     * viewer — the preview the user sees IS the bytes that get printed.
     */
    previewHtml: (
      html: string,
      options?: { title?: string; landscape?: boolean },
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.PRINT_PREVIEW_HTML, { html, ...options }),
  },
  // WasenderAPI (WhatsApp). The renderer can store/forget a token and make
  // authenticated requests, but can NEVER read the token back — it lives
  // encrypted in the main process (see wasender.ts).
  wasender: {
    setToken: (token: string): Promise<{ ok: boolean; encrypted: boolean }> =>
      ipcRenderer.invoke(IPC.WASENDER_SET_TOKEN, token),
    clearToken: (): Promise<{ ok: boolean }> => ipcRenderer.invoke(IPC.WASENDER_CLEAR_TOKEN),
    hasToken: (): Promise<boolean> => ipcRenderer.invoke(IPC.WASENDER_HAS_TOKEN),
    setApiKey: (key: string): Promise<{ ok: boolean; encrypted: boolean }> =>
      ipcRenderer.invoke(IPC.WASENDER_SET_APIKEY, key),
    clearApiKey: (): Promise<{ ok: boolean }> => ipcRenderer.invoke(IPC.WASENDER_CLEAR_APIKEY),
    hasApiKey: (): Promise<boolean> => ipcRenderer.invoke(IPC.WASENDER_HAS_APIKEY),
    request: (args: {
      baseUrl: string;
      method?: string;
      path: string;
      body?: unknown;
      headers?: Record<string, string>;
      timeoutMs?: number;
      useApiKey?: boolean;
    }): Promise<{ ok: boolean; status: number; data: unknown; error?: string }> =>
      ipcRenderer.invoke(IPC.WASENDER_REQUEST, args),
  },
  // DORMANT — no renderer code calls this today (see main.ts). Kept so a
  // future feature can subscribe without touching the preload bridge.
  deepLink: {
    onLink: (listener: (url: string) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, url: string) => listener(url);
      ipcRenderer.on("deep-link", handler);
      return () => ipcRenderer.removeListener("deep-link", handler);
    },
  },
};

export type MtjDesktopApi = typeof api;

contextBridge.exposeInMainWorld("mtjDesktop", api);
