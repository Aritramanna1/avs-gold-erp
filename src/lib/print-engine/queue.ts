/**
 * Unified Print Engine — Print Queue integration.
 *
 * Thin wrapper over print-queue.ts's recordJob/getPrintJobHistory/
 * listAvailablePrinters — the durable print_jobs history already exists
 * and already feeds reports.print-queue.tsx; reused verbatim.
 *
 * `recordPrintOutcome` fixes one confirmed bug for the engine's own future
 * dispatch path: hardware-service.ts's submitPrintJob() always calls
 * recordJob() with pdfFileName=undefined and never passes status
 * "pdf_fallback", even on the PDF-fallback branch — so today's print_jobs
 * history under-reports fallbacks. Not fixed in hardware-service.ts itself
 * (that would change live behavior, out of scope for Phase 0); fixed here
 * so the new engine's own dispatch, once wired in Phase 1+, records
 * correctly from day one.
 */
import {
  getPrintJobHistory,
  listAvailablePrinters,
  makeId,
  recordJob,
  type PrinterInfo,
  type PrintJobResult,
} from "@/lib/print/print-queue";

export { getPrintJobHistory, listAvailablePrinters, makeId };
export type { PrinterInfo, PrintJobResult };

export async function recordPrintOutcome(
  docType: string,
  title: string,
  result: { success: boolean; message?: string; pdfFileName?: string },
): Promise<void> {
  const status: PrintJobResult["status"] = result.success
    ? result.pdfFileName
      ? "pdf_fallback"
      : "printed"
    : "failed";
  await recordJob(
    makeId(),
    docType,
    title,
    status,
    1,
    result.success ? undefined : result.message,
    result.pdfFileName,
  );
}
