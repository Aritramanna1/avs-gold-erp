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
  DIAGNOSTICS_REPORT_ERROR: "diagnostics:report-error",
  HYBRID_VALIDATE_SETUP: "hybrid:validate-setup",
  // Retained for compatibility. The owner applies the master SQL outside the
  // customer application; the renderer never submits database passwords.
  HYBRID_INITIALIZE_SCHEMA: "hybrid:initialize-schema",
  SECURE_STORE_GET: "secure-store:get",
  SECURE_STORE_SET: "secure-store:set",
  SECURE_STORE_DELETE: "secure-store:delete",
  WINDOW_MINIMIZE: "window:minimize",
  WINDOW_MAXIMIZE_TOGGLE: "window:maximize-toggle",
  WINDOW_CLOSE: "window:close",
  PRINT_LIST_PRINTERS: "print:list-printers",
  PRINT_HTML: "print:html",
  PRINT_PREVIEW_HTML: "print:preview-html",
  // WasenderAPI (WhatsApp) — token lives ONLY in the main process (encrypted
  // via safeStorage); the renderer never sees it. Every authenticated call is
  // proxied through WASENDER_REQUEST.
  WASENDER_SET_TOKEN: "wasender:set-token",
  WASENDER_CLEAR_TOKEN: "wasender:clear-token",
  WASENDER_HAS_TOKEN: "wasender:has-token",
  // Session API Key — the credential WasenderAPI's messaging endpoints require
  // (distinct from the account Personal Access Token). Also encrypted, main-only.
  WASENDER_SET_APIKEY: "wasender:set-apikey",
  WASENDER_CLEAR_APIKEY: "wasender:clear-apikey",
  WASENDER_HAS_APIKEY: "wasender:has-apikey",
  WASENDER_REQUEST: "wasender:request",
  WASENDER_UPLOAD_MEDIA: "wasender:upload-media",
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
