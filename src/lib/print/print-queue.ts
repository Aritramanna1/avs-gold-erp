/**
 * Reliable Print Job Queue (Priority 5).
 *
 * Every print attempt goes through here and is durably recorded (SQLite
 * `print_jobs` table) — never fired-and-forgotten. Two execution paths:
 *
 *  - Desktop (Electron, window.mtjDesktop present): renders the same HTML
 *    a browser would print, but via the main process's PRINT_HTML IPC —
 *    this is what makes silent printing and named-printer selection real,
 *    since a plain browser tab can't do either.
 *  - Browser (no Electron bridge): falls back to the existing
 *    iframe/window.print() flow already used by PrintPreviewModal — no
 *    change to that path's behavior.
 *
 * Whichever path is used, ANY failure — no printer configured, print
 * cancelled at the OS level, Electron IPC error, anything — automatically
 * generates a real PDF (via the existing document-pdf-generator.ts for
 * invoice/order/repair/manufacturing_bill, or tag-pdf-fallback.ts for
 * barcode/tag labels) and downloads it. A print job's outcome is always
 * one of `printed` or `pdf_fallback` — genuinely reaching `failed` should
 * be exceptional (client-side PDF rendering itself throwing).
 */
import { runLocal, getDb, initLocalDb } from "@/lib/local-db";

export interface PrintJobResult {
  jobId: string;
  status: "printed" | "pdf_fallback" | "failed";
  error?: string;
  pdfFileName?: string;
}

export function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `pj_${crypto.randomUUID()}`;
  return `pj_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export interface PrinterInfo {
  name: string;
  displayName: string;
  description: string;
  isDefault: boolean;
}

interface MtjDesktopPrintApi {
  print: {
    listPrinters(): Promise<PrinterInfo[]>;
    printHtml(
      html: string,
      options?: { silent?: boolean; printerName?: string },
    ): Promise<{ success: boolean; error?: string }>;
  };
}

function getDesktopApi(): MtjDesktopPrintApi | null {
  return typeof window !== "undefined" && "mtjDesktop" in window
    ? (window as unknown as { mtjDesktop: MtjDesktopPrintApi }).mtjDesktop
    : null;
}

/**
 * Records one print job's outcome to the same `print_jobs` history the
 * Print Queue report (reports.print-queue.tsx) reads from. Called by
 * hardware-service.ts's submitPrintJob() — the call site every print
 * button in the app actually goes through.
 */
export async function recordJob(
  id: string,
  docType: string,
  title: string,
  status: PrintJobResult["status"],
  attempts: number,
  error: string | undefined,
  pdfFileName: string | undefined,
): Promise<void> {
  await runLocal(() => {
    getDb().run(
      `INSERT INTO print_jobs (id, doc_type, title, status, attempts, last_error, pdf_file_name, created_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        id,
        docType,
        title,
        status,
        attempts,
        error ?? null,
        pdfFileName ?? null,
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );
  });
}
export async function listAvailablePrinters(): Promise<PrinterInfo[]> {
  const desktop = getDesktopApi();
  if (!desktop) return [];
  return desktop.print.listPrinters();
}

export async function getPrintJobHistory(limit = 100): Promise<
  Array<{
    id: string;
    docType: string;
    title: string;
    status: string;
    attempts: number;
    lastError: string | null;
    pdfFileName: string | null;
    createdAt: string;
  }>
> {
  await initLocalDb();
  const { queryTable } = await import("@/lib/local-db");
  const rows = (queryTable("print_jobs", "", []) as Record<string, unknown>[])
    .sort((a, b) => (b.created_at as string).localeCompare(a.created_at as string))
    .slice(0, limit);
  return rows.map((r) => ({
    id: r.id as string,
    docType: r.doc_type as string,
    title: r.title as string,
    status: r.status as string,
    attempts: Number(r.attempts),
    lastError: (r.last_error as string) ?? null,
    pdfFileName: (r.pdf_file_name as string) ?? null,
    createdAt: r.created_at as string,
  }));
}
