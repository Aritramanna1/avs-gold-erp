import { toast } from "sonner";

export type ErrorSeverity = "info" | "warning" | "error" | "critical";

export type ErrorCategory =
  | "database"
  | "network"
  | "validation"
  | "file"
  | "authentication"
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

function classifyError(
  error: Error,
): Pick<
  NormalizedAppError,
  "title" | "message" | "guidance" | "category" | "severity" | "recoverable"
> {
  const text = `${error.name} ${error.message}`.toLowerCase();

  if (
    text.includes("database") ||
    text.includes("transaction") ||
    text.includes("constraint") ||
    text.includes("foreign key") ||
    text.includes("unique") ||
    text.includes("locked") ||
    text.includes("no rows returned") ||
    text.includes("missing in supabase") ||
    text.includes("schema is out of date") ||
    text.includes("migration")
  ) {
    return {
      title: "Database operation could not finish",
      message: "The application could not complete a database operation.",
      guidance:
        "Check connection and retry. If this mentions schema or migration, ask the administrator to apply the latest database migration before continuing.",
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
      message: "The app could not reach an online service.",
      guidance:
        "Check your internet connection and retry when the service is available.",
      category: "network",
      severity: "warning",
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
    technicalMessage: err.message || err.name || "Unknown error",
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

export function logAppError(error: NormalizedAppError): void {
  console.error(`[${error.id}] ${error.title}`, {
    category: error.category,
    context: error.context,
    message: error.technicalMessage,
    stack: error.stack,
  });
}

export function reportUnexpectedError(error: unknown, context?: string): NormalizedAppError {
  const normalized = normalizeError(error, context);
  logAppError(normalized);
  return normalized;
}

export function showErrorToast(error: NormalizedAppError): void {
  const description = `${error.message} Reference: ${error.id}`;
  if (error.severity === "warning") toast.warning(error.title, { description, duration: 7000 });
  else toast.error(error.title, { description, duration: 9000 });
}

export async function runAsyncSafely<T>(
  context: string,
  fn: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const normalized = reportUnexpectedError(error, context);
    showErrorToast(normalized);
    return fallback;
  }
}

let installed = false;

export function installGlobalRendererErrorHandlers(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (event) => {
    const normalized = reportUnexpectedError(event.error ?? event.message, "window.error");
    showErrorToast(normalized);
  });

  window.addEventListener("unhandledrejection", (event) => {
    event.preventDefault();
    // Vite's own dev-server HMR client throws this when its websocket drops
    // (e.g. the dev server restarting) — dev/test tooling noise, never a real
    // app error, and never present in a production build. Surfacing it as a
    // user-facing "Something went wrong" toast trained users to ignore real
    // errors and, worse, fired even on a clean first load.
    const reasonMessage =
      event.reason instanceof Error ? event.reason.message : String(event.reason);
    if (import.meta.env.DEV && /WebSocket closed without opened/.test(reasonMessage)) {
      return;
    }
    const normalized = reportUnexpectedError(event.reason, "window.unhandledrejection");
    showErrorToast(normalized);
  });

  const originalAlert = window.alert.bind(window);
  window.alert = (message?: unknown) => {
    try {
      toast.warning("Action needed", {
        description: String(message ?? "Please review the information and try again."),
        duration: 7000,
      });
    } catch {
      originalAlert(String(message ?? "Please review the information and try again."));
    }
  };
}
