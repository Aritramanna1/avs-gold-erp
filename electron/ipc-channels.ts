/**
 * Every IPC channel the desktop shell exposes, in one place. Both main.ts and
 * preload.ts import from here so the allowed channel list can never drift
 * between the two sides of the context-isolation boundary.
 */
export const IPC = {
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
  HARDWARE_EVENT: "hardware:event", // main -> renderer push (scan results, weight readings, etc.)
  PRINT_LIST_PRINTERS: "print:list-printers",
  PRINT_HTML: "print:html",
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
