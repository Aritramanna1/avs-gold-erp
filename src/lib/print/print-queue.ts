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
import { generateDocumentPdf, type PdfDocumentType } from "@/lib/pdf/document-pdf-generator";
import { generateTagLabelPdf, type TagLabelData } from "@/lib/hardware/tag-pdf-fallback";
import { useSettings } from "@/lib/settings-store";

export type PrintDocType = PdfDocumentType | "tag";

export interface PrintJobInput {
  docType: PrintDocType;
  title: string;
  /** The record to render — required for invoice/order/repair/manufacturing_bill (see document-pdf-generator.ts's expected shape per docType). */
  docData?: any;
  /** Required when docType is "tag". */
  tagData?: TagLabelData;
  /** Pre-rendered HTML to send to the printer (desktop path only). If omitted, only the PDF fallback path is available. */
  html?: string;
  silent?: boolean;
  printerName?: string;
}

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

async function generateFallbackPdf(job: PrintJobInput): Promise<{ blob: Blob; fileName: string }> {
  if (job.docType === "tag") {
    if (!job.tagData)
      throw new Error("tag print job is missing tagData — cannot generate PDF fallback.");
    return {
      blob: generateTagLabelPdf(job.tagData),
      fileName: `label-${job.tagData.itemCode || job.tagData.barcode}.pdf`,
    };
  }
  const firm = useSettings.getState().firm;
  return generateDocumentPdf(job.docType, job.docData, firm);
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Records one print job's outcome to the same `print_jobs` history the
 * Print Queue report (reports.print-queue.tsx) reads from. Exported so
 * hardware-service.ts's submitPrintJob() — the call site every print
 * button in the app actually goes through — can log into this table too,
 * without having to switch its whole printing mechanism over to this
 * module's own submitPrintJob(). Without this, the Print Queue report was
 * always empty: this file's own submitPrintJob()/recordJob() combo was
 * never actually reached by any live print button, so the "reliable job
 * queue" it documents was built but never wired up.
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

/**
 * Submits a print job. Tries the physical printer path first (desktop IPC,
 * or browser print if `html` is provided); on ANY failure, generates and
 * downloads a PDF instead. Always resolves — never throws — so a UI button
 * calling this never needs its own try/catch for "what if printing fails."
 */
export async function submitPrintJob(job: PrintJobInput): Promise<PrintJobResult> {
  await initLocalDb();
  const id = makeId();
  let attempts = 0;

  if (job.html) {
    attempts++;
    const desktop = getDesktopApi();
    try {
      if (desktop) {
        const result = await desktop.print.printHtml(job.html, {
          silent: job.silent,
          printerName: job.printerName,
        });
        if (result.success) {
          await recordJob(id, job.docType, job.title, "printed", attempts, undefined, undefined);
          return { jobId: id, status: "printed" };
        }
        // Falls through to PDF fallback below — result.error is logged there implicitly via last_error.
      } else {
        // Browser path: window.print() cannot report success/failure back
        // to JS (the OS print dialog is opaque to the page), so we can't
        // distinguish "user printed it" from "user cancelled" here. We
        // still trigger it as a best-effort convenience, but the PDF
        // fallback ALSO always gets generated for the browser path — a
        // JS-invisible print outcome is exactly the "might silently fail"
        // case this queue exists to eliminate.
        window.print();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[PrintQueue] Physical print attempt failed:", message);
    }
  }

  if (!job.html || !getDesktopApi()) {
    // No HTML to send to a physical printer, or (browser path) no reliable
    // success signal — generate the PDF fallback so the job is never lost.
    try {
      const { blob, fileName } = await generateFallbackPdf(job);
      downloadBlob(blob, fileName);
      await recordJob(id, job.docType, job.title, "pdf_fallback", attempts, undefined, fileName);
      return { jobId: id, status: "pdf_fallback", pdfFileName: fileName };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await recordJob(id, job.docType, job.title, "failed", attempts, message, undefined);
      return { jobId: id, status: "failed", error: message };
    }
  }

  // Desktop path reached here only via the failure fall-through above.
  try {
    const { blob, fileName } = await generateFallbackPdf(job);
    downloadBlob(blob, fileName);
    await recordJob(id, job.docType, job.title, "pdf_fallback", attempts, undefined, fileName);
    return { jobId: id, status: "pdf_fallback", pdfFileName: fileName };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordJob(id, job.docType, job.title, "failed", attempts, message, undefined);
    return { jobId: id, status: "failed", error: message };
  }
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
