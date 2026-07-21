import { app, dialog } from "electron";
import fs from "node:fs";
import path from "node:path";

export interface MainProcessErrorReport {
  id: string;
  title: string;
  message: string;
  guidance: string;
  category: string;
  severity: string;
  technicalMessage: string;
  stack?: string;
  context?: string;
  timestamp: string;
  recoverable: boolean;
}

function createErrorId(): string {
  return `ERR-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random()
    .toString(36)
    .slice(2, 10)
    .toUpperCase()}`;
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

export function normalizeMainError(error: unknown, context?: string): MainProcessErrorReport {
  const err = asError(error);
  const text = `${err.name} ${err.message}`.toLowerCase();
  let category = "unknown";
  let title = "Desktop service problem";
  let message = "A desktop service could not complete the requested operation.";
  let guidance = "Retry the action. If it repeats, contact support with the Error Reference ID.";
  let severity = "error";

  if (text.includes("ipc") || text.includes("renderer")) {
    category = "ipc";
  } else if (text.includes("print") || text.includes("pdf") || text.includes("file")) {
    category = "file";
    title = "File or print operation failed";
    message = "The file, export, or print operation could not be completed.";
    guidance = "Check printer availability, file permissions, and disk space, then retry.";
  } else if (text.includes("fetch") || text.includes("timeout") || text.includes("network")) {
    category = "network";
    title = "Connection problem";
    message = "The desktop app could not reach an online service.";
    guidance = "Continue offline where available and retry when the service is reachable.";
    severity = "warning";
  } else if (
    text.includes("safe storage") ||
    text.includes("credential") ||
    text.includes("encrypt")
  ) {
    category = "authentication";
    title = "Protected storage problem";
    message = "The desktop app could not access protected credential storage.";
    guidance = "Restart the app. If it repeats, contact support with the Error Reference ID.";
  }

  return {
    id: createErrorId(),
    title,
    message,
    guidance,
    category,
    severity,
    technicalMessage: err.message || err.name || "Unknown error",
    stack: err.stack,
    context,
    timestamp: new Date().toISOString(),
    recoverable: true,
  };
}

export function logMainError(error: unknown, context?: string): MainProcessErrorReport {
  const report =
    typeof error === "object" && error !== null && "id" in error && "technicalMessage" in error
      ? (error as MainProcessErrorReport)
      : normalizeMainError(error, context);
  const line = `${JSON.stringify(report)}\n`;
  try {
    const logsDir = app.isReady() ? app.getPath("logs") : path.join(process.cwd(), "logs");
    fs.mkdirSync(logsDir, { recursive: true });
    fs.appendFileSync(path.join(logsDir, "error-diagnostics.log"), line, "utf8");
  } catch {
    // Logging must never crash the app.
  }
  console.error(`[${report.id}] ${report.title}`, report);
  return report;
}

export function installMainProcessErrorHandlers(): void {
  process.on("uncaughtException", (error) => {
    const report = logMainError(error, "process.uncaughtException");
    if (app.isReady()) {
      dialog
        .showMessageBox({
          type: "error",
          title: report.title,
          message: report.message,
          detail: `${report.guidance}\n\nError Reference ID: ${report.id}`,
          buttons: ["Continue"],
          noLink: true,
        })
        .catch(() => {});
    }
  });

  process.on("unhandledRejection", (reason) => {
    logMainError(reason, "process.unhandledRejection");
  });
}
