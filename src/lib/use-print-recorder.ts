/**
 * MTJ ERP — Print recorder hooks
 *
 *   useRecordPrintOnce({...}) — call inside a print preview page; logs
 *   the first view automatically. Subsequent prints from the same preview
 *   open the reprint reason dialog when triggered via doReprint().
 *
 * This used to be an independent implementation with its own recordPrint()
 * call path, duplicating (and able to drift from) usePrintRecord.ts's logic
 * — two print-history systems meant Print History/Reprint could behave
 * differently depending on which hook a given route happened to call.
 * Reconciled onto a single canonical path: this is now a thin, backward-
 * compatible wrapper over usePrintRecord's legacy-args mode, so every
 * existing call site keeps working unchanged while there is only one place
 * that actually records a print event or dispatches to hardwareService.
 */
import { useCallback } from "react";
import type { ReprintReason } from "@/lib/printlog-store";
import { usePrintRecord, type UsePrintRecordArgs } from "@/components/print/usePrintRecord";

export type RecordPrintArgs = UsePrintRecordArgs;

export function useRecordPrintOnce(args: RecordPrintArgs | null) {
  const { reprintOpen, setReprintOpen, recordReprint } = usePrintRecord(args);

  const requestReprint = useCallback(() => setReprintOpen(true), [setReprintOpen]);
  const closeReprint = useCallback(() => setReprintOpen(false), [setReprintOpen]);
  const doReprint = useCallback(
    (reason: ReprintReason, note?: string) => recordReprint(reason, note),
    [recordReprint],
  );

  return { reprintOpen, requestReprint, closeReprint, doReprint };
}
