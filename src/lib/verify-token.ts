/**
 * AVS ERP print verification token.
 *
 * Each printed document carries a short payload of the form
 *
 *     AVS|<DOC_TYPE>|<DOC_NUMBER>|<RECORD_ID>|<CHECKSUM>
 *
 * The checksum is the first 8 hex chars of a deterministic non-crypto hash
 * over (docType, docNumber, recordId, createdAtISO). This is NOT a
 * cryptographic signature — it is a tamper-detection token for in-shop
 * receipt verification. Deliberately excludes the shop name: /verify is a
 * public, unauthenticated route (so a customer's phone can scan without an
 * ERP login) and never hydrates useSettings, so including firm.shopName
 * here made every checksum unrecomputable on the verify side — the token
 * would never match, ever, even for a genuine unmodified document.
 *
 * Legacy `MTJ|...` payloads are still accepted so old printed documents remain
 * verifiable after the AVS brand cleanup.
 */
import type { PrintDocType } from "@/lib/printlog-store";
import { useOrders } from "@/lib/orders-store";
import { useJobCards } from "@/lib/jobcards-store";
import { useBilling } from "@/lib/billing-store";
import { useRepairs } from "@/lib/repair-store";
import { useRateCuts } from "@/lib/ratecut-store";
import { useDailyCloses } from "@/lib/dailyclose-store";
import { usePeople } from "@/lib/people-store";
import { useStock } from "@/lib/stock-store";
import { useGoldSettlement } from "@/lib/gold-settlement-store";
import { useWorkers } from "@/lib/workers-store";

const CURRENT_VERIFY_APP = "AVS";
const LEGACY_VERIFY_APP = "MTJ";

function simpleHash(s: string): string {
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const out = (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
  return out.slice(0, 8);
}

export interface PayloadInput {
  docType: PrintDocType;
  docNumber: string;
  recordId: string;
  createdAt?: number | string | Date;
}

export function payloadFor(d: PayloadInput): string {
  const iso = d.createdAt ? new Date(d.createdAt).toISOString().slice(0, 10) : "";
  const checksum = simpleHash([d.docType, d.docNumber, d.recordId, iso].join("|"));
  return `${CURRENT_VERIFY_APP}|${d.docType}|${d.docNumber}|${d.recordId}|${checksum}`;
}

export interface ParsedPayload {
  app: "AVS" | "MTJ";
  docType: PrintDocType;
  docNumber: string;
  recordId: string;
  checksum: string;
}

export function parsePayload(raw: string): ParsedPayload | null {
  const m = raw.trim().match(/^(AVS|MTJ)\|([a-z_]+)\|([^|]+)\|([^|]+)\|([0-9a-f]{8})$/i);
  if (!m) return null;
  return {
    app: m[1].toUpperCase() === LEGACY_VERIFY_APP ? LEGACY_VERIFY_APP : CURRENT_VERIFY_APP,
    docType: m[2] as PrintDocType,
    docNumber: m[3],
    recordId: m[4],
    checksum: m[5].toLowerCase(),
  };
}

export interface ResolvedDoc {
  docType: PrintDocType;
  docNumber: string;
  recordId: string;
  createdAt?: number;
  customerName?: string;
  linkedSummary?: string;
}

/** Look up the live record this payload refers to. */
export function resolveDoc(p: ParsedPayload): ResolvedDoc | null {
  const id = p.recordId;
  switch (p.docType) {
    case "order_slip":
    case "gold_receipt":
    case "old_gold_receipt":
    case "advance_receipt": {
      const o = useOrders.getState().orders.find((x) => x.id === id);
      if (!o) return null;
      const c = usePeople.getState().people.find((x) => x.id === o.customerId);
      return {
        docType: p.docType,
        docNumber: o.orderNo,
        recordId: o.id,
        createdAt: o.createdAt,
        customerName: c?.fullName,
        linkedSummary: `${o.item.itemName} · ${o.item.purity}`,
      };
    }
    case "job_card":
    case "gold_issue_slip":
    case "gold_receive_slip":
    case "filings_receipt": {
      const j = useJobCards.getState().jobs.find((x) => x.id === id);
      if (!j) return null;
      return {
        docType: p.docType,
        docNumber: j.jobNo,
        recordId: j.id,
        createdAt: j.createdAt,
        customerName: j.customerName,
        linkedSummary: `${j.itemName} · ${j.purity}`,
      };
    }
    case "gst_invoice":
    case "retail_invoice":
    case "payment_receipt": {
      const i = useBilling.getState().invoices.find((x) => x.id === id);
      if (!i) return null;
      return {
        docType: p.docType,
        docNumber: i.invoiceNo,
        recordId: i.id,
        createdAt: i.createdAt,
        customerName: i.customerName,
      };
    }
    case "repair_receipt":
    case "repair_delivery_slip":
    case "repair_invoice":
    case "polishing_receipt": {
      const r = useRepairs.getState().repairs.find((x) => x.id === id);
      if (!r) return null;
      return {
        docType: p.docType,
        docNumber: r.repairNo,
        recordId: r.id,
        createdAt: r.createdAt,
        customerName: r.customerName,
      };
    }
    case "ratecut_slip": {
      const rc = useRateCuts.getState().records.find((x) => x.id === id);
      if (!rc) return null;
      return { docType: p.docType, docNumber: rc.slipNo, recordId: rc.id, createdAt: rc.ts };
    }
    case "daily_close_report": {
      const dc = (
        useDailyCloses.getState() as { closes: { id: string; date: string; createdAt: number }[] }
      ).closes.find((x) => x.id === id);
      if (!dc) return null;
      return { docType: p.docType, docNumber: dc.date, recordId: dc.id, createdAt: dc.createdAt };
    }
    case "jewellery_tag": {
      const s = useStock.getState().items.find((x) => x.id === id);
      if (!s) return null;
      return {
        docType: p.docType,
        docNumber: s.itemCode || s.id,
        recordId: s.id,
        createdAt: s.createdAt,
      };
    }
    case "worker_kyc": {
      const pPerson = usePeople.getState().people.find((x) => x.id === id);
      if (!pPerson) return null;
      return {
        docType: p.docType,
        docNumber: `KYC-${pPerson.id.toUpperCase().slice(-6)}`,
        recordId: pPerson.id,
        createdAt: pPerson.createdAt || Date.now(),
        customerName: pPerson.fullName,
        linkedSummary: `Role: ${pPerson.type || "Worker"} · KYC progress: ${pPerson.kycProgress || "Pending"}`,
      };
    }
    case "gold_settlement": {
      const gs = useGoldSettlement.getState().settlements.find((x) => x.id === id);
      if (!gs) return null;
      const party = usePeople.getState().people.find((x) => x.id === gs.party_id);
      return {
        docType: p.docType,
        docNumber: gs.id.toUpperCase().slice(-8),
        recordId: gs.id,
        createdAt: gs.settlement_date ? new Date(gs.settlement_date).getTime() : Date.now(),
        customerName: party?.fullName ?? "Internal Worker",
        linkedSummary: `${gs.settlement_type.toUpperCase()} · Fine gold: ${gs.net_mg ? (gs.net_mg / 1000).toFixed(3) : "0"}g`,
      };
    }
    case "home_settlement_slip": {
      const st = useWorkers.getState().settlements.find((x) => x.id === id);
      if (!st) return null;
      const wr = usePeople.getState().people.find((x) => x.id === st.workerId);
      return {
        docType: p.docType,
        docNumber: `SET-${st.id.toUpperCase().slice(-6)}`,
        recordId: st.id,
        createdAt: st.createdAt,
        customerName: wr?.fullName ?? "Worker",
        linkedSummary: `Settled from ${st.fromDate} to ${st.toDate} · Salary: ₹${(st.salaryEarnedPaise / 100).toLocaleString("en-IN")}`,
      };
    }
    case "gold_advance_slip": {
      const ga = useWorkers.getState().goldAdvances.find((x) => x.id === id);
      if (!ga) return null;
      const wr = usePeople.getState().people.find((x) => x.id === ga.workerId);
      return {
        docType: p.docType,
        docNumber: `GADV-${ga.id.toUpperCase().slice(-6)}`,
        recordId: ga.id,
        createdAt: ga.createdAt,
        customerName: wr?.fullName,
        linkedSummary: `Gold Advance: ${(ga.fineMg / 1000).toFixed(3)}g fine gold`,
      };
    }
    case "wastage_return_receipt": {
      const wrr = useWorkers.getState().wastageReturns.find((x) => x.id === id);
      if (!wrr) return null;
      const wr = usePeople.getState().people.find((x) => x.id === wrr.workerId);
      return {
        docType: p.docType,
        docNumber: `WR-${wrr.id.toUpperCase().slice(-6)}`,
        recordId: wrr.id,
        createdAt: wrr.createdAt,
        customerName: wr?.fullName,
        linkedSummary: `Wastage Return: ${(wrr.fineMg / 1000).toFixed(3)}g fine gold`,
      };
    }
    case "loan_slip": {
      const ln = useWorkers.getState().loans.find((x) => x.id === id);
      if (!ln) return null;
      const wr = usePeople.getState().people.find((x) => x.id === ln.workerId);
      return {
        docType: p.docType,
        docNumber: `LOAN-${ln.id.toUpperCase().slice(-6)}`,
        recordId: ln.id,
        createdAt: ln.createdAt,
        customerName: wr?.fullName,
        linkedSummary: `Worker Loan Issued: ₹${(ln.amountPaise / 100).toLocaleString("en-IN")}`,
      };
    }
    case "withdrawal_slip": {
      const wd = useWorkers.getState().withdrawals.find((x) => x.id === id);
      if (!wd) return null;
      const wr = usePeople.getState().people.find((x) => x.id === wd.workerId);
      return {
        docType: p.docType,
        docNumber: `WD-${wd.id.toUpperCase().slice(-6)}`,
        recordId: wd.id,
        createdAt: wd.createdAt,
        customerName: wr?.fullName,
        linkedSummary: `Worker Cash Withdrawal: ₹${(wd.amountPaise / 100).toLocaleString("en-IN")}`,
      };
    }
    default:
      return null;
  }
}

export type VerifyOutcome =
  | { ok: true; doc: ResolvedDoc; payload: ParsedPayload }
  | { ok: false; reason: "format" | "not_found" | "tampered"; payload?: ParsedPayload };

/** Re-derive checksum from the resolved doc and compare. */
export function verifyPayload(raw: string): VerifyOutcome {
  const parsed = parsePayload(raw);
  if (!parsed) return { ok: false, reason: "format" };
  const doc = resolveDoc(parsed);
  if (!doc) return { ok: false, reason: "not_found", payload: parsed };
  const expected = parsePayload(
    payloadFor({
      docType: doc.docType,
      docNumber: doc.docNumber,
      recordId: doc.recordId,
      createdAt: doc.createdAt,
    }),
  );
  if (!expected || expected.checksum !== parsed.checksum) {
    return { ok: false, reason: "tampered", payload: parsed };
  }
  return { ok: true, doc, payload: parsed };
}
