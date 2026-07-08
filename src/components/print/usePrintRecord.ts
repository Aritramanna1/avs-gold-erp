import { useState, useEffect, useRef, useCallback } from "react";
import {
  usePrintLog,
  type PrintDocType,
  type ReprintReason,
  type PrintEvent,
} from "@/lib/printlog-store";
import { useOrders } from "@/lib/orders-store";
import { useJobCards } from "@/lib/jobcards-store";
import { useBilling } from "@/lib/billing-store";
import { useRepairs } from "@/lib/repair-store";
import { useRateCuts } from "@/lib/ratecut-store";
import { useDailyCloses } from "@/lib/dailyclose-store";
import { useStock } from "@/lib/stock-store";
import { usePeople } from "@/lib/people-store";
import { useGoldSettlement } from "@/lib/gold-settlement-store";
import { useWorkers } from "@/lib/workers-store";
import { hardwareService, type PrinterType } from "@/lib/hardware-service";
import {
  useCreditNotes,
  useDebitNotes,
  useEstimates,
  useDeliveryChallans,
} from "@/lib/billing-documents-store";

export interface UsePrintRecordArgs {
  docType: PrintDocType;
  docNumber: string;
  linkedId: string;
  linkedLabel?: string;
  printedBy?: string;
}

/**
 * Standardized Unified Hook for Documents State & Print Log Registry.
 * Supports legacy single-object tracking and new dual-param reactive fetching interfaces.
 */
export function usePrintRecord(
  docTypeOrArgs: PrintDocType | UsePrintRecordArgs | null,
  idParam?: string,
) {
  let docType: PrintDocType | undefined;
  let id: string | undefined;
  let legacyArgs: UsePrintRecordArgs | null = null;

  if (docTypeOrArgs && typeof docTypeOrArgs === "object") {
    legacyArgs = docTypeOrArgs as UsePrintRecordArgs;
    docType = legacyArgs.docType;
    id = legacyArgs.linkedId;
  } else if (typeof docTypeOrArgs === "string") {
    docType = docTypeOrArgs;
    id = idParam;
  }

  // Reactive selects for active records across all 28 modules
  const ordersRecord = useOrders((s) => s.orders.find((x) => x.id === id));
  const jobCardsRecord = useJobCards((s) => s.jobs.find((x) => x.id === id));
  const billingRecord = useBilling((s) => s.invoices.find((x) => x.id === id));
  const repairsRecord = useRepairs((s) => s.repairs.find((x) => x.id === id));
  const rateCutRecord = useRateCuts((s) => s.records.find((x) => x.id === id));
  const dailyCloseRecord = useDailyCloses((s) => s.closes.find((x) => x.id === id));
  const stockRecord = useStock((s) => s.items.find((x) => x.id === id));
  const peopleRecord = usePeople((s) => s.people.find((x) => x.id === id));
  const goldSettlementRecord = useGoldSettlement((s) => s.settlements.find((x) => x.id === id));
  const workerSettlementRecord = useWorkers((s) => s.settlements.find((x) => x.id === id));
  const goldAdvanceRecord = useWorkers((s) => s.goldAdvances.find((x) => x.id === id));
  const wastageReturnRecord = useWorkers((s) => s.wastageReturns.find((x) => x.id === id));
  const loanRecord = useWorkers((s) => s.loans.find((x) => x.id === id));
  const withdrawalRecord = useWorkers((s) => s.withdrawals.find((x) => x.id === id));
  const creditNoteRecord = useCreditNotes((s) => s.notes.find((x) => x.id === id));
  const debitNoteRecord = useDebitNotes((s) => s.notes.find((x) => x.id === id));
  const estimateRecord = useEstimates((s) => s.estimates.find((x) => x.id === id));
  const deliveryChallanRecord = useDeliveryChallans((s) => s.challans.find((x) => x.id === id));

  let record: any = null;
  let docNumber = "";
  let linkedLabel = "";
  let customerName = "";

  if (docType && id) {
    switch (docType) {
      case "order_slip":
      case "gold_receipt":
      case "old_gold_receipt":
      case "advance_receipt": {
        const o = ordersRecord;
        if (o) {
          record = o;
          docNumber = o.orderNo;
          linkedLabel = `${o.item.itemName} · ${o.item.purity}`;
          const c = usePeople.getState().people.find((x) => x.id === o.customerId);
          customerName = c?.fullName || "";
        }
        break;
      }
      case "job_card":
      case "gold_issue_slip":
      case "gold_receive_slip":
      case "filings_receipt": {
        const j = jobCardsRecord;
        if (j) {
          record = j;
          docNumber = j.jobNo;
          linkedLabel = `${j.itemName} · ${j.purity}`;
          customerName = j.customerName || "";
        }
        break;
      }
      case "gst_invoice":
      case "retail_invoice":
      case "payment_receipt": {
        const i = billingRecord;
        if (i) {
          record = i;
          docNumber = i.invoiceNo;
          customerName = i.customerName || "";
        }
        break;
      }
      case "repair_receipt":
      case "repair_delivery_slip":
      case "repair_invoice":
      case "polishing_receipt": {
        const r = repairsRecord;
        if (r) {
          record = r;
          docNumber = r.repairNo;
          customerName = r.customerName || "";
        }
        break;
      }
      case "ratecut_slip": {
        const rc = rateCutRecord;
        if (rc) {
          record = rc;
          docNumber = rc.slipNo;
        }
        break;
      }
      case "daily_close_report": {
        const dc = dailyCloseRecord;
        if (dc) {
          record = dc;
          docNumber = dc.date;
        }
        break;
      }
      case "jewellery_tag": {
        const s = stockRecord;
        if (s) {
          record = s;
          docNumber = s.itemCode || s.id;
        }
        break;
      }
      case "worker_kyc": {
        const pPerson = peopleRecord;
        if (pPerson) {
          record = pPerson;
          docNumber = `KYC-${pPerson.id.toUpperCase().slice(-6)}`;
          customerName = pPerson.fullName;
          linkedLabel = `Role: ${pPerson.type || "Worker"} · KYC progress: ${pPerson.kycProgress || "Pending"}`;
        }
        break;
      }
      case "gold_settlement": {
        const gs = goldSettlementRecord;
        if (gs) {
          record = gs;
          docNumber = gs.id.toUpperCase().slice(-8);
          linkedLabel = `${gs.settlement_type.toUpperCase()} · Fine gold: ${gs.net_mg ? (gs.net_mg / 1000).toFixed(3) : "0"}g`;
          const party = usePeople.getState().people.find((x) => x.id === gs.party_id);
          customerName = party?.fullName ?? "Internal Worker";
        }
        break;
      }
      case "home_settlement_slip": {
        const st = workerSettlementRecord;
        if (st) {
          record = st;
          docNumber = `SET-${st.id.toUpperCase().slice(-6)}`;
          linkedLabel = `Settled from ${st.fromDate} to ${st.toDate} · Salary: ₹${(st.salaryEarnedPaise / 100).toLocaleString("en-IN")}`;
          const wr = usePeople.getState().people.find((x) => x.id === st.workerId);
          customerName = wr?.fullName ?? "Worker";
        }
        break;
      }
      case "gold_advance_slip": {
        const ga = goldAdvanceRecord;
        if (ga) {
          record = ga;
          docNumber = `GADV-${ga.id.toUpperCase().slice(-6)}`;
          linkedLabel = `Gold Advance: ${(ga.fineMg / 1000).toFixed(3)}g fine gold`;
          const wr = usePeople.getState().people.find((x) => x.id === ga.workerId);
          customerName = wr?.fullName || "";
        }
        break;
      }
      case "wastage_return_receipt": {
        const wrr = wastageReturnRecord;
        if (wrr) {
          record = wrr;
          docNumber = `WR-${wrr.id.toUpperCase().slice(-6)}`;
          linkedLabel = `Wastage Return: ${(wrr.fineMg / 1000).toFixed(3)}g fine gold`;
          const wr = usePeople.getState().people.find((x) => x.id === wrr.workerId);
          customerName = wr?.fullName || "";
        }
        break;
      }
      case "loan_slip": {
        const ln = loanRecord;
        if (ln) {
          record = ln;
          docNumber = `LOAN-${ln.id.toUpperCase().slice(-6)}`;
          linkedLabel = `Worker Loan Issued: ₹${(ln.amountPaise / 100).toLocaleString("en-IN")}`;
          const wr = usePeople.getState().people.find((x) => x.id === ln.workerId);
          customerName = wr?.fullName || "";
        }
        break;
      }
      case "withdrawal_slip": {
        const wd = withdrawalRecord;
        if (wd) {
          record = wd;
          docNumber = `WD-${wd.id.toUpperCase().slice(-6)}`;
          linkedLabel = `Worker Cash Withdrawal: ₹${(wd.amountPaise / 100).toLocaleString("en-IN")}`;
          const wr = usePeople.getState().people.find((x) => x.id === wd.workerId);
          customerName = wr?.fullName || "";
        }
        break;
      }
      case "credit_note": {
        const cn = creditNoteRecord;
        if (cn) {
          record = cn;
          docNumber = cn.creditNoteNo;
          customerName = cn.customerName || "";
          linkedLabel = `Against Invoice ${cn.invoiceNo}`;
        }
        break;
      }
      case "debit_note": {
        const dn = debitNoteRecord;
        if (dn) {
          record = dn;
          docNumber = dn.debitNoteNo;
          customerName = dn.customerName || "";
          linkedLabel = `Against Invoice ${dn.invoiceNo}`;
        }
        break;
      }
      case "estimate_doc": {
        const est = estimateRecord;
        if (est) {
          record = est;
          docNumber = est.estimateNo;
          customerName = est.customerName || "";
        }
        break;
      }
      case "delivery_challan": {
        const dc = deliveryChallanRecord;
        if (dc) {
          record = dc;
          docNumber = dc.challanNo;
          customerName = dc.customerName || "";
        }
        break;
      }
    }
  }

  // Override derived values with explicitly provided legacy args if any
  if (legacyArgs) {
    docNumber = legacyArgs.docNumber || docNumber;
    linkedLabel = legacyArgs.linkedLabel || linkedLabel;
  }

  const recordLogger = usePrintLog((s) => s.recordPrint);
  const events = usePrintLog((s) => s.events);
  const [reprintOpen, setReprintOpen] = useState(false);
  const fired = useRef<string | null>(null);

  // Derive loading & error status synchronously based on data presence
  const loading = !record && !!id;
  const error =
    id && !record && !loading ? `Document metadata not found for reference "${id}".` : null;

  // Find if this document has been printed before
  const existingEvent =
    docType && id ? events.find((e) => e.docType === docType && e.linkedId === id) : undefined;

  const isReprint = !!existingEvent;

  // Automatically record first viewing if no event exists
  useEffect(() => {
    if (!docType || !id || !docNumber) return;

    const key = `${docType}_${id}`;
    if (fired.current === key) return;
    fired.current = key;

    if (!existingEvent) {
      recordLogger({
        docType,
        docNumber,
        linkedId: id,
        linkedLabel: linkedLabel || undefined,
        printedBy: "Owner",
      });
    }
  }, [docType, id, docNumber, linkedLabel, existingEvent, recordLogger]);

  const handlePrintTrigger = useCallback(() => {
    if (isReprint) {
      setReprintOpen(true);
    } else {
      let pType: PrinterType = "a4";
      if (docType === "jewellery_tag") pType = "tag";
      else if (
        docType?.includes("receipt") ||
        docType?.includes("slip") ||
        docType?.includes("invoice")
      ) {
        pType = "thermal_80";
      }

      hardwareService.submitPrintJob({
        type: pType,
        title: `${docType?.replace("_", " ").toUpperCase() || "Document"} - ${docNumber}`,
        data: record,
      });

      setTimeout(() => window.print(), 50);
    }
  }, [isReprint, docType, docNumber, record]);

  const recordReprint = useCallback(
    (reason: ReprintReason, note?: string) => {
      if (!docType || !id || !docNumber) return;
      recordLogger({
        docType,
        docNumber,
        linkedId: id,
        linkedLabel: linkedLabel || undefined,
        reason,
        note,
      });

      let pType: PrinterType = "a4";
      if (docType === "jewellery_tag") pType = "tag";
      else if (
        docType?.includes("receipt") ||
        docType?.includes("slip") ||
        docType?.includes("invoice")
      ) {
        pType = "thermal_80";
      }

      hardwareService.submitPrintJob({
        type: pType,
        title: `REPRINT: ${docType?.replace("_", " ").toUpperCase() || "Document"} - ${docNumber}`,
        data: { ...record, reprintReason: reason, reprintNote: note },
      });

      setReprintOpen(false);
      setTimeout(() => window.print(), 100);
    },
    [docType, id, docNumber, linkedLabel, recordLogger, record],
  );

  return {
    record,
    loading,
    error,
    docNumber,
    linkedLabel,
    customerName,
    isReprint,
    reprintCount: existingEvent ? existingEvent.reprintCount : 0,
    reprintOpen,
    setReprintOpen,
    handlePrintTrigger,
    recordReprint,
    existingEvent,
  };
}
