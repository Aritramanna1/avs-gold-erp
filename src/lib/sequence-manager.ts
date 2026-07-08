import { nextDocumentNumber } from "./document-numbering";
import { useOrders } from "./orders-store";
import { useBilling } from "./billing-store";
import { useJobCards } from "./jobcards-store";
import { useCatalog } from "./catalog-store";
import { useDailyCloses } from "./dailyclose-store";
import { usePeople } from "./people-store";
import { useRepairs } from "./repair-store";
import { useGoldSettlement } from "./gold-settlement-store";

export type SequenceType =
  | "order"
  | "invoice"
  | "jobcard"
  | "repair"
  | "expense"
  | "gold_settlement"
  | "design"
  | "daily_close"
  | "customer"
  | "worker"
  | "receipt"
  | "gold_purchase"
  | "credit_note"
  | "debit_note"
  | "estimate"
  | "delivery_challan"
  | "payment"
  | "barcode";

/**
 * Centrally computes the Indian Financial Year prefix (April 1st to March 31st).
 * E.g., for June 25th, 2026, the financial year is 2026-2027, formatted as '26-27'.
 */
export function getFinancialYearPrefix(type: SequenceType): { prefix: string; yearStr: string } {
  const d = new Date();
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1-indexed month
  const fyStart = month >= 4 ? year : year - 1;
  const fyEnd = fyStart + 1;
  const yearStr = `${String(fyStart).slice(-2)}-${String(fyEnd).slice(-2)}`;

  let prefix = "";
  if (type === "order") {
    prefix = `ORD-${yearStr}-`;
  } else if (type === "invoice") {
    prefix = `MTJ/${yearStr}/`;
  } else if (type === "jobcard") {
    prefix = `JC-${yearStr}-`;
  } else if (type === "repair") {
    prefix = `RP-${yearStr}-`;
  } else if (type === "expense" || type === "gold_settlement") {
    prefix = `EXP-${yearStr}-`;
  } else if (type === "design") {
    prefix = `DSG-${year}-`;
  } else if (type === "daily_close") {
    prefix = `CLS-${year}-`;
  } else if (type === "customer") {
    prefix = `CUST-`;
  } else if (type === "worker") {
    prefix = `WRK-`;
  } else if (type === "receipt") {
    prefix = `RCT-${yearStr}-`;
  } else if (type === "gold_purchase") {
    prefix = `GP-${yearStr}-`;
  } else if (type === "credit_note") {
    prefix = `CN-${yearStr}-`;
  } else if (type === "debit_note") {
    prefix = `DN-${yearStr}-`;
  } else if (type === "estimate") {
    prefix = `EST-${yearStr}-`;
  } else if (type === "delivery_challan") {
    prefix = `DC-${yearStr}-`;
  } else if (type === "payment") {
    prefix = `PAY-${yearStr}-`;
  } else if (type === "barcode") {
    prefix = `BAR-${yearStr}-`;
  }
  return { prefix, yearStr };
}

/**
 * Centrally coordinates document sequence generation — every sequence type
 * shares the single real atomic engine (document-numbering.ts's
 * `next_document_number()` RPC, a single `INSERT ... ON CONFLICT DO UPDATE
 * ... RETURNING` safe under concurrent transactions via Postgres row
 * locking). Previously this called a `generate_sequential_number` RPC that
 * was never actually deployed to the database, meaning every consumer
 * (credit notes, debit notes, estimates, delivery challans) was silently
 * always running the vulnerable local-memory fallback below — fixed by
 * routing through the same real RPC every other document type now uses.
 */
export async function getNextSequenceNumber(type: SequenceType): Promise<string> {
  const { prefix, yearStr } = getFinancialYearPrefix(type);
  // Key includes the FY/year token so each financial year gets its own
  // counter starting at 0001 — the prefix alone changing every year would
  // otherwise leave the *underlying* counter climbing forever across years.
  return nextDocumentNumber(`${type}:${yearStr}`, prefix, 4);
}

/**
 * Calculates sequentials locally based on current memory state
 */
export function getNextSequenceSync(type: SequenceType): string {
  const { prefix } = getFinancialYearPrefix(type);
  let maxNum = 0;

  if (type === "order") {
    const existing = useOrders.getState().orders;
    existing.forEach((o) => {
      if (o.orderNo && o.orderNo.startsWith(prefix)) {
        const val = parseInt(o.orderNo.slice(prefix.length), 10);
        if (!isNaN(val) && val > maxNum) maxNum = val;
      }
    });
  } else if (type === "invoice") {
    const existing = useBilling.getState().invoices;
    existing.forEach((inv) => {
      if (inv.invoiceNo && inv.invoiceNo.startsWith(prefix)) {
        const val = parseInt(inv.invoiceNo.slice(prefix.length), 10);
        if (!isNaN(val) && val > maxNum) maxNum = val;
      }
    });
  } else if (type === "jobcard") {
    const existing = useJobCards.getState().jobs;
    existing.forEach((j) => {
      if (j.jobNo && j.jobNo.startsWith(prefix)) {
        const val = parseInt(j.jobNo.slice(prefix.length), 10);
        if (!isNaN(val) && val > maxNum) maxNum = val;
      }
    });
  } else if (type === "repair") {
    const existing = useRepairs.getState().repairs;
    existing.forEach((r) => {
      if (r.repairNo && r.repairNo.startsWith(prefix)) {
        const val = parseInt(r.repairNo.slice(prefix.length), 10);
        if (!isNaN(val) && val > maxNum) maxNum = val;
      }
    });
  } else if (type === "expense" || type === "gold_settlement") {
    const existing = useGoldSettlement.getState().settlements;
    existing.forEach((s) => {
      if (s.id && s.id.startsWith(prefix)) {
        const val = parseInt(s.id.slice(prefix.length), 10);
        if (!isNaN(val) && val > maxNum) maxNum = val;
      }
    });
  } else if (type === "design") {
    const existing = useCatalog.getState().designs;
    existing.forEach((d) => {
      if (d.designNumber && d.designNumber.startsWith(prefix)) {
        const val = parseInt(d.designNumber.slice(prefix.length), 10);
        if (!isNaN(val) && val > maxNum) maxNum = val;
      }
    });
  } else if (type === "daily_close") {
    const existing = useDailyCloses.getState().closes;
    existing.forEach((c) => {
      if (c.id && c.id.startsWith(prefix)) {
        const val = parseInt(c.id.slice(prefix.length), 10);
        if (!isNaN(val) && val > maxNum) maxNum = val;
      }
    });
  } else if (type === "customer") {
    const existing = usePeople
      .getState()
      .people.filter((p) => p.type === "customer" || p.type === "firm_customer");
    existing.forEach((p) => {
      if (p.id && p.id.startsWith(prefix)) {
        const val = parseInt(p.id.slice(prefix.length), 10);
        if (!isNaN(val) && val > maxNum) maxNum = val;
      }
    });
  } else if (type === "worker") {
    const existing = usePeople
      .getState()
      .people.filter((p) => p.type === "karigar" || p.type === "worker" || p.type === "employee");
    existing.forEach((p) => {
      if (p.id && p.id.startsWith(prefix)) {
        const val = parseInt(p.id.slice(prefix.length), 10);
        if (!isNaN(val) && val > maxNum) maxNum = val;
      }
    });
  } else {
    // Generic localStorage fallback to ensure unique, sequential numbering for new/dynamic modules
    const key = `seq_local_max_${type}_${prefix}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      maxNum = parseInt(stored, 10) || 0;
    }
  }

  const nextVal = maxNum + 1;
  const seq = String(nextVal).padStart(4, "0");

  if (
    ![
      "order",
      "invoice",
      "jobcard",
      "repair",
      "expense",
      "gold_settlement",
      "design",
      "daily_close",
      "customer",
      "worker",
    ].includes(type)
  ) {
    const key = `seq_local_max_${type}_${prefix}`;
    localStorage.setItem(key, String(nextVal));
  }

  return `${prefix}${seq}`;
}
