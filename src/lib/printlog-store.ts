/**
 * MTJ ERP — Print Log / Reprint Registry
 */
import { create } from "zustand";
import { createRepository } from "./repositories/base-repository";

export type PrintDocType =
  | "order_slip"
  | "gold_receipt"
  | "old_gold_receipt"
  | "advance_receipt"
  | "job_card"
  | "gold_issue_slip"
  | "gold_receive_slip"
  | "filings_receipt"
  | "repair_receipt"
  | "repair_delivery_slip"
  | "repair_invoice"
  | "polishing_receipt"
  | "gst_invoice"
  | "retail_invoice"
  | "payment_receipt"
  | "ratecut_slip"
  | "jewellery_tag"
  | "worker_kyc"
  | "attendance_sheet"
  | "withdrawal_slip"
  | "loan_slip"
  | "gold_advance_slip"
  | "wastage_return_receipt"
  | "worker_passbook"
  | "home_settlement_slip"
  | "gold_settlement"
  | "daily_close_report"
  | "customer_ledger_statement"
  | "karigar_custody_statement"
  | "worker_material_given"
  | "worker_material_return"
  | "credit_note"
  | "debit_note"
  | "estimate_doc"
  | "delivery_challan";

export const PRINT_DOC_LABELS: Record<PrintDocType, string> = {
  order_slip: "Order Slip",
  gold_receipt: "Customer Gold Receipt",
  old_gold_receipt: "Old Gold Receipt",
  advance_receipt: "Advance Receipt",
  job_card: "Job Card",
  gold_issue_slip: "Gold Issue Slip",
  gold_receive_slip: "Gold Receive Slip",
  filings_receipt: "Filings Receipt",
  repair_receipt: "Repair Receipt",
  repair_delivery_slip: "Repair Delivery Slip",
  repair_invoice: "Repair Invoice",
  polishing_receipt: "Polishing Receipt",
  gst_invoice: "GST Invoice",
  retail_invoice: "Retail Invoice",
  payment_receipt: "Payment Receipt",
  ratecut_slip: "Rate-Cut Slip",
  jewellery_tag: "Jewellery Tag",
  worker_kyc: "Worker / Karigar KYC Sheet",
  attendance_sheet: "Attendance Sheet",
  withdrawal_slip: "Withdrawal Slip",
  loan_slip: "Loan Slip",
  gold_advance_slip: "Gold Advance Slip",
  wastage_return_receipt: "Wastage Gold Return Receipt",
  worker_passbook: "Worker Passbook",
  home_settlement_slip: "Home-Going Settlement Slip",
  gold_settlement: "Gold Settlement Receipt",
  daily_close_report: "Daily Close Report",
  customer_ledger_statement: "Customer Ledger Statement",
  karigar_custody_statement: "Karigar Custody Statement",
  worker_material_given: "Worker Material Given",
  worker_material_return: "Worker Material Return",
  credit_note: "Credit Note",
  debit_note: "Debit Note",
  estimate_doc: "Estimate",
  delivery_challan: "Delivery Challan",
};

export type ReprintReason = "wrong_printer" | "customer_copy" | "office_copy" | "damaged" | "other";

export const REPRINT_REASON_LABELS: Record<ReprintReason, string> = {
  wrong_printer: "Wrong Printer",
  customer_copy: "Customer Copy",
  office_copy: "Office Copy",
  damaged: "Damaged Print",
  other: "Other",
};

export interface PrintEvent {
  id: string;
  docType: PrintDocType;
  docNumber: string;
  linkedId: string;
  linkedLabel?: string;
  printedBy: string;
  firstPrintedAt: number;
  lastPrintedAt: number;
  reprintCount: number;
  history: { ts: number; reason?: ReprintReason; note?: string }[];
}

interface PrintLogState {
  events: PrintEvent[];
  /** Returns existing event (if any) and increments reprint counter on subsequent calls. */
  recordPrint: (args: {
    docType: PrintDocType;
    docNumber: string;
    linkedId: string;
    linkedLabel?: string;
    printedBy?: string;
    reason?: ReprintReason;
    note?: string;
  }) => PrintEvent;
  reset: () => void;
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `pl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

const printLogRepository = createRepository<PrintEvent>("print_logs");

export const usePrintLog = create<PrintLogState>()((set, get) => ({
  events: [],
  recordPrint: ({
    docType,
    docNumber,
    linkedId,
    linkedLabel,
    printedBy = "Owner",
    reason,
    note,
  }) => {
    const now = Date.now();
    const existing = get().events.find((e) => e.docType === docType && e.linkedId === linkedId);
    if (existing) {
      const updated: PrintEvent = {
        ...existing,
        lastPrintedAt: now,
        reprintCount: existing.reprintCount + 1,
        history: [...existing.history, { ts: now, reason, note }],
      };
      set({ events: get().events.map((e) => (e.id === existing.id ? updated : e)) });
      void printLogRepository.save(updated);
      return updated;
    }
    const ev: PrintEvent = {
      id: makeId(),
      docType,
      docNumber,
      linkedId,
      linkedLabel,
      printedBy,
      firstPrintedAt: now,
      lastPrintedAt: now,
      reprintCount: 0,
      history: [{ ts: now, reason, note }],
    };
    set({ events: [ev, ...get().events] });
    void printLogRepository.save(ev);
    return ev;
  },
  reset: () => set({ events: [] }),
}));
