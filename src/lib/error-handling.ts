import { toast } from "sonner";

export type ErrorSeverity = "info" | "warning" | "error" | "critical";

export type ErrorCategory =
  | "database"
  | "network"
  | "validation"
  | "file"
  | "authentication"
  | "licensing"
  | "ipc"
  | "renderer"
  | "unknown";

export interface NormalizedAppError {
  id: string;
  title: string;
  message: string;
  guidance: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  technicalMessage: string;
  stack?: string;
  context?: string;
  timestamp: string;
  recoverable: boolean;
}

type DesktopDiagnosticsApi = {
  diagnostics?: {
    reportError?: (payload: NormalizedAppError) => Promise<void>;
  };
};

const LOG_KEY = "mtj_erp_error_log";
const MAX_LOGS = 50;

function createErrorId(): string {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `ERR-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${suffix.toUpperCase()}`;
}

function asError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === "string") return new Error(error);
  try {
    return new Error(JSON.stringify(error));
  } catch {
    return new Error(String(error));
  }
}

function describeCaughtError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object") {
    const rec = error as { message?: string; code?: string; details?: string };
    const bits = [rec.message, rec.code ? `[${rec.code}]` : null, rec.details].filter(Boolean);
    if (bits.length) return bits.join(" — ");
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function classifyError(
  error: Error,
): Pick<
  NormalizedAppError,
  "title" | "message" | "guidance" | "category" | "severity" | "recoverable"
> {
  const text = `${error.name} ${error.message}`.toLowerCase();

  if (
    error.name === "AbortError" ||
    error.name === "TimeoutError" ||
    text.includes("fetch is aborted") ||
    text.includes("the user aborted") ||
    text.includes("signal is aborted") ||
    text.includes("aborterror")
  ) {
    return {
      title: "Connection interrupted",
      message: "Connection was interrupted. Please try again.",
      guidance: "Retry the action. If this keeps happening, check your network and refresh the page.",
      category: "network",
      severity: "warning",
      recoverable: true,
    };
  }

  if (
    error.name === "LocalDbIntegrityError" ||
    text.includes("integrity_check") ||
    text.includes("checksum mismatch") ||
    text.includes("database disk image is malformed") ||
    text.includes("corrupt")
  ) {
    return {
      title: "Database needs attention",
      message: error.message || "The Supabase-backed database operation could not be completed safely.",
      guidance:
        "Use Retry once. If it fails again, create a support ticket and ask the administrator to verify the latest Supabase migration and project health.",
      category: "database",
      severity: "critical",
      recoverable: true,
    };
  }

  if (
    text.includes("sqlite") ||
    text.includes("database") ||
    text.includes("transaction") ||
    text.includes("constraint") ||
    text.includes("foreign key") ||
    text.includes("unique") ||
    text.includes("locked") ||
    text.includes("no rows returned") ||
    text.includes("missing in supabase") ||
    text.includes("schema is out of date") ||
    text.includes("migration") ||
    text.includes("row-level security") ||
    text.includes("ledger entry rejected") ||
    text.includes("bucket deltas") ||
    text.includes("gold vault") ||
    text.includes("insufficient vault") ||
    text.includes("gold_ledger")
  ) {
    return {
      title: "Database operation could not finish",
      message: error.message || "The application could not complete a database operation.",
      guidance:
        "The database rejected this save. Use the message above (schema, RLS, or constraint) to correct the record. Do not assume the document was posted.",
      category: "database",
      severity: "error",
      recoverable: true,
    };
  }

  if (
    text.includes("network") ||
    text.includes("fetch") ||
    text.includes("timeout") ||
    text.includes("timed out") ||
    text.includes("aborterror") ||
    text.includes("supabase") ||
    text.includes("api unavailable") ||
    text.includes("failed to fetch")
  ) {
    return {
      title: "Connection problem",
      message: error.message || "The app could not reach an online service.",
      guidance:
        "Wait for the online connection to recover, then retry. If it repeats, create a support ticket with the Error Reference ID.",
      category: "network",
      severity: "warning",
      recoverable: true,
    };
  }

  if (
    text.includes("license") ||
    text.includes("activation") ||
    text.includes("device limit") ||
    text.includes("entitlement")
  ) {
    return {
      title: "License check could not be completed",
      message: "The license or activation state needs attention.",
      guidance:
        "Check the license status, verify internet access for activation, or contact support with the Error Reference ID.",
      category: "licensing",
      severity: "error",
      recoverable: true,
    };
  }

  if (
    text.includes("auth") ||
    text.includes("credential") ||
    text.includes("session") ||
    text.includes("password") ||
    text.includes("sign in") ||
    text.includes("login")
  ) {
    return {
      title: "Sign-in problem",
      message: "Authentication could not be completed.",
      guidance:
        "Check the credentials, session state, and network connection. Sign in again if the session has expired.",
      category: "authentication",
      severity: "warning",
      recoverable: true,
    };
  }

  if (
    text.includes("file") ||
    text.includes("permission") ||
    text.includes("disk") ||
    text.includes("export") ||
    text.includes("print") ||
    text.includes("pdf") ||
    text.includes("format")
  ) {
    return {
      title: "File or print operation failed",
      message: "The app could not complete the file, export, or print operation.",
      guidance:
        "Check file permissions, disk space, printer availability, and file format, then retry.",
      category: "file",
      severity: "warning",
      recoverable: true,
    };
  }

  if (
    text.includes("required") ||
    text.includes("invalid") ||
    text.includes("must") ||
    text.includes("select") ||
    text.includes("enter")
  ) {
    return {
      title: "Information needs correction",
      message: "Some required information is missing or invalid.",
      guidance: "Review the highlighted information, correct it, and try again.",
      category: "validation",
      severity: "warning",
      recoverable: true,
    };
  }

  if (text.includes("ipc") || text.includes("renderer") || text.includes("electron")) {
    return {
      title: "Desktop service problem",
      message: "The desktop shell could not complete a protected operation.",
      guidance:
        "Retry the action. If it repeats, restart the app and contact support with the Error Reference ID.",
      category: "ipc",
      severity: "error",
      recoverable: true,
    };
  }

  if (
    text.includes("maximum update depth") ||
    text.includes("minified react error #185") ||
    text.includes("react error #185") ||
    text.includes("too many re-renders")
  ) {
    return {
      title: "Screen could not finish loading",
      message:
        "This page hit an internal rendering loop and stopped to protect your session.",
      guidance:
        "Use Try again or hard-refresh (Ctrl+Shift+R). If it repeats, note which menu you opened and contact support with the Error Reference ID.",
      category: "renderer",
      severity: "error",
      recoverable: true,
    };
  }

  return {
    title: "Something went wrong",
    message: "The app hit an unexpected problem, but your session can continue.",
    guidance: "Retry the action. If it happens again, contact support with the Error Reference ID.",
    category: "unknown",
    severity: "error",
    recoverable: true,
  };
}

export function normalizeError(error: unknown, context?: string): NormalizedAppError {
  const err = asError(error);
  const classified = classifyError(err);
  return {
    id: createErrorId(),
    ...classified,
    technicalMessage: describeCaughtError(error) || err.message || err.name || "Unknown error",
    stack: err.stack,
    context,
    timestamp: new Date().toISOString(),
  };
}

export function formatErrorDetails(error: NormalizedAppError): string {
  return [
    `Error Reference ID: ${error.id}`,
    `Time: ${error.timestamp}`,
    `Category: ${error.category}`,
    `Severity: ${error.severity}`,
    error.context ? `Context: ${error.context}` : null,
    `User message: ${error.message}`,
    `Guidance: ${error.guidance}`,
    `Technical message: ${error.technicalMessage}`,
    error.stack ? `Stack:\n${error.stack}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function storeLog(error: NormalizedAppError): void {
  try {
    const logs = JSON.parse(sessionStorage.getItem(LOG_KEY) ?? "[]") as NormalizedAppError[];
    logs.unshift(error);
    sessionStorage.setItem(LOG_KEY, JSON.stringify(logs.slice(0, MAX_LOGS)));
  } catch {
    // Diagnostics must never become a user-facing failure.
  }
}

export function logAppError(error: NormalizedAppError): void {
  storeLog(error);
  console.error(`[${error.id}] ${error.title}`, {
    category: error.category,
    context: error.context,
    message: error.technicalMessage,
    stack: error.stack,
  });
  const desktop =
    typeof window !== "undefined"
      ? (window as unknown as { mtjDesktop?: DesktopDiagnosticsApi }).mtjDesktop
      : undefined;
  void desktop?.diagnostics?.reportError?.(error).catch(() => {});
  void reportErrorToPlatform(error);
}

/** Background hydration errors — logged, never toasted (avoids ERP-wide toast storms). */
export function logBackgroundError(error: unknown, context?: string): NormalizedAppError {
  const normalized = normalizeError(error, context);
  logAppError(normalized);
  return normalized;
}

// Best-effort telemetry so the platform owner's Health view has real data -
// previously an error only reached the browser console, invisible from the
// admin side entirely. Never lets a reporting failure become user-visible.
async function reportErrorToPlatform(error: NormalizedAppError): Promise<void> {
  try {
    const [{ dataProvider: supabase }] = await Promise.all([
      import("@/lib/providers/data-provider"),
    ]);
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    await supabase.from("platform_error_events" as never).insert({
      actor_id: userId ?? null,
      reference_id: error.id,
      category: error.category,
      severity: error.severity,
      context: error.context ?? null,
      message: error.message,
      technical_message: error.technicalMessage,
    } as never);
  } catch {
    // Telemetry must never become a second failure on top of the first.
  }
}

export function reportUnexpectedError(error: unknown, context?: string): NormalizedAppError {
  const normalized = normalizeError(error, context);
  logAppError(normalized);
  return normalized;
}

export function showErrorToast(error: NormalizedAppError): void {
  const preferTechnical =
    (error.category === "unknown" || error.category === "renderer") &&
    error.technicalMessage &&
    error.technicalMessage !== error.message &&
    !error.technicalMessage.toLowerCase().includes("unknown error");
  const text = preferTechnical ? error.technicalMessage : error.message;
  void import("@/lib/ui-feedback").then(({ emitUiFeedback }) => {
    emitUiFeedback(error.severity === "warning" ? "warning" : "error");
  });
  toast(text, { duration: 6000, id: "ornexa-user-notice" });
}

/** User-initiated action failed — toast once. Background work should use logBackgroundError. */
export function reportUserFacingError(error: unknown, context?: string): NormalizedAppError {
  const normalized = reportUnexpectedError(error, context);
  showErrorToast(normalized);
  return normalized;
}

export async function runAsyncSafely<T>(
  context: string,
  fn: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    reportUserFacingError(error, context);
    return fallback;
  }
}

let installed = false;

export function installGlobalRendererErrorHandlers(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (event) => {
    const payload = event.error ?? event.message;
    if (!payload) return;
    reportUnexpectedError(payload, "window.error");
  });

  window.addEventListener("unhandledrejection", (event) => {
    event.preventDefault();
    const reasonMessage =
      event.reason instanceof Error ? event.reason.message : String(event.reason);
    if (import.meta.env.DEV && /WebSocket closed without opened/.test(reasonMessage)) {
      return;
    }
    reportUnexpectedError(event.reason, "window.unhandledrejection");
  });

  const originalAlert = window.alert.bind(window);
  window.alert = (message?: unknown) => {
    try {
      toast(String(message ?? "Please review the information and try again."), {
        duration: 5000,
        id: "ornexa-user-notice",
      });
    } catch {
      originalAlert(String(message ?? "Please review the information and try again."));
    }
  };
}
