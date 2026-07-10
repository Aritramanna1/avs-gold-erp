/**
 * Unified Print Engine — Audit integration.
 *
 * Thin wrapper over printlog-store.ts's usePrintLog — the reprint audit
 * log is already correct and already feeds reports.print-log.tsx; the
 * engine reuses it verbatim rather than starting a second audit trail.
 * usePrintRecord.ts already calls recordPrint directly for every migrated
 * route today, so PrintEngine.tsx (which uses usePrintRecord internally)
 * gets this for free — this module exists for call sites that need the
 * audit log without the rest of usePrintRecord's store-resolution switch.
 */
import {
  usePrintLog,
  type PrintDocType,
  type PrintEvent,
  type ReprintReason,
} from "@/lib/printlog-store";

export type { PrintDocType, PrintEvent, ReprintReason };

export function recordPrintEvent(args: {
  docType: PrintDocType;
  docNumber: string;
  linkedId: string;
  linkedLabel?: string;
  printedBy?: string;
  reason?: ReprintReason;
  note?: string;
}): PrintEvent {
  return usePrintLog.getState().recordPrint(args);
}

export function findPrintEvent(docType: PrintDocType, linkedId: string): PrintEvent | undefined {
  return usePrintLog
    .getState()
    .events.find((e) => e.docType === docType && e.linkedId === linkedId);
}
