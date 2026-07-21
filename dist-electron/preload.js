"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
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
};
const api = {
    app: {
        getVersion: () => electron_1.ipcRenderer.invoke(IPC.APP_GET_VERSION),
        relaunch: () => electron_1.ipcRenderer.invoke(IPC.APP_RELAUNCH),
    },
    dialog: {
        openFile: (options) => electron_1.ipcRenderer.invoke(IPC.DIALOG_OPEN_FILE, options),
        saveFile: (options) => electron_1.ipcRenderer.invoke(IPC.DIALOG_SAVE_FILE, options),
    },
    notify: {
        show: (title, body) => electron_1.ipcRenderer.invoke(IPC.NOTIFY_SHOW, { title, body }),
    },
    window: {
        minimize: () => electron_1.ipcRenderer.send(IPC.WINDOW_MINIMIZE),
        maximizeToggle: () => electron_1.ipcRenderer.send(IPC.WINDOW_MAXIMIZE_TOGGLE),
        close: () => electron_1.ipcRenderer.send(IPC.WINDOW_CLOSE),
    },
    print: {
        listPrinters: () => electron_1.ipcRenderer.invoke(IPC.PRINT_LIST_PRINTERS),
        printHtml: (html, options) => electron_1.ipcRenderer.invoke(IPC.PRINT_HTML, { html, ...options }),
        /**
         * Renders the document HTML to a PDF and opens it in Chromium's PDF
         * viewer — the preview the user sees IS the bytes that get printed.
         */
        previewHtml: (html, options) => electron_1.ipcRenderer.invoke(IPC.PRINT_PREVIEW_HTML, { html, ...options }),
    },
    // WasenderAPI (WhatsApp). The renderer can store/forget a token and make
    // authenticated requests, but can NEVER read the token back — it lives
    // encrypted in the main process (see wasender.ts).
    wasender: {
        setToken: (token) => electron_1.ipcRenderer.invoke(IPC.WASENDER_SET_TOKEN, token),
        clearToken: () => electron_1.ipcRenderer.invoke(IPC.WASENDER_CLEAR_TOKEN),
        hasToken: () => electron_1.ipcRenderer.invoke(IPC.WASENDER_HAS_TOKEN),
        setApiKey: (key) => electron_1.ipcRenderer.invoke(IPC.WASENDER_SET_APIKEY, key),
        clearApiKey: () => electron_1.ipcRenderer.invoke(IPC.WASENDER_CLEAR_APIKEY),
        hasApiKey: () => electron_1.ipcRenderer.invoke(IPC.WASENDER_HAS_APIKEY),
        request: (args) => electron_1.ipcRenderer.invoke(IPC.WASENDER_REQUEST, args),
    },
    // DORMANT — no renderer code calls this today (see main.ts). Kept so a
    // future feature can subscribe without touching the preload bridge.
    deepLink: {
        onLink: (listener) => {
            const handler = (_event, url) => listener(url);
            electron_1.ipcRenderer.on("deep-link", handler);
            return () => electron_1.ipcRenderer.removeListener("deep-link", handler);
        },
    },
};
electron_1.contextBridge.exposeInMainWorld("mtjDesktop", api);
