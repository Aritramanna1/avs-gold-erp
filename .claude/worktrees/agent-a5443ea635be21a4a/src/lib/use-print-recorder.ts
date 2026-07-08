/**
 * MTJ ERP — Print recorder hooks
 *
 *   useRecordPrintOnce({...}) — call inside a print preview page; logs
 *   the first view automatically. Subsequent prints from the same preview
 *   open the reprint reason dialog when triggered via doReprint().
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { usePrintLog, type PrintDocType, type ReprintReason } from "@/lib/printlog-store";

export interface RecordPrintArgs {
  docType: PrintDocType;
  docNumber: string;
  linkedId: string;
  linkedLabel?: string;
  printedBy?: string;
}

export function useRecordPrintOnce(args: RecordPrintArgs | null) {
  const record = usePrintLog((s) => s.recordPrint);
  const fired = useRef(false);
  const [reprintOpen, setReprintOpen] = useState(false);

  useEffect(() => {
    if (!args) return;
    if (fired.current) return;
    fired.current = true;
    record({ ...args });
  }, [args, record]);

  const requestReprint = useCallback(() => setReprintOpen(true), []);
  const closeReprint = useCallback(() => setReprintOpen(false), []);
  const doReprint = useCallback(
    (reason: ReprintReason, note?: string) => {
      if (!args) return;
      record({ ...args, reason, note });
      // Use system print after recording so the audit always lands first.
      setTimeout(() => window.print(), 50);
    },
    [args, record],
  );

  return { reprintOpen, requestReprint, closeReprint, doReprint };
}
