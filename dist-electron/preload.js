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
    HARDWARE_LIST_DEVICES: "hardware:list-devices",
    HARDWARE_CONNECT: "hardware:connect",
    HARDWARE_DISCONNECT: "hardware:disconnect",
    HARDWARE_SEND_COMMAND: "hardware:send-command",
    HARDWARE_EVENT: "hardware:event",
    PRINT_LIST_PRINTERS: "print:list-printers",
    PRINT_HTML: "print:html",
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
    hardware: {
        listDevices: () => electron_1.ipcRenderer.invoke(IPC.HARDWARE_LIST_DEVICES),
        connect: (id) => electron_1.ipcRenderer.invoke(IPC.HARDWARE_CONNECT, id),
        disconnect: (id) => electron_1.ipcRenderer.invoke(IPC.HARDWARE_DISCONNECT, id),
        sendCommand: (id, command, commandArgs) => electron_1.ipcRenderer.invoke(IPC.HARDWARE_SEND_COMMAND, { id, command, commandArgs }),
        onEvent: (listener) => {
            const handler = (_event, payload) => listener(payload);
            electron_1.ipcRenderer.on(IPC.HARDWARE_EVENT, handler);
            return () => electron_1.ipcRenderer.removeListener(IPC.HARDWARE_EVENT, handler);
        },
    },
    print: {
        listPrinters: () => electron_1.ipcRenderer.invoke(IPC.PRINT_LIST_PRINTERS),
        printHtml: (html, options) => electron_1.ipcRenderer.invoke(IPC.PRINT_HTML, { html, ...options }),
    },
    deepLink: {
        onLink: (listener) => {
            const handler = (_event, url) => listener(url);
            electron_1.ipcRenderer.on("deep-link", handler);
            return () => electron_1.ipcRenderer.removeListener("deep-link", handler);
        },
    },
};
electron_1.contextBridge.exposeInMainWorld("mtjDesktop", api);
