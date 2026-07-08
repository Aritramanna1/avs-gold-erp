/**
 * Outside Work (External Jeweller) workflow — digitizes the paper "Outside
 * Work register" used when gold/material is sent to an external jeweller
 * (chain makers, ball makers, KDM suppliers, etc.) and finished work comes
 * back. Deliberately a transaction log, not a manufacturing workflow engine
 * — every issue and every receive is one immutable OutsideWorkTransaction,
 * and every balance/position shown anywhere is derived from that log, never
 * stored/edited directly (no manual balance editing, per spec).
 *
 * Mirrors order-issue-store.ts / worker-return-store.ts's established
 * pattern: this store only persists the transaction record; the calling
 * dialog orchestrates the Gold Ledger + timeline updates.
 */
import { create } from "zustand";
import { createRepository } from "./repositories/base-repository";
import { nextDocumentNumber } from "./document-numbering";

export type OutsideWorkTxnType = "issue" | "receive";

export interface OutsideWorkTransaction {
  id: string;
  txnNo: string;
  ts: number;
  type: OutsideWorkTxnType;
  jewellerId: string;
  jewellerName: string;
  orderId?: string;
  orderNo?: string;
  materialType: string; // e.g. "Gold", "Chain", "Ball", "KDM", "Wire", "Finding", "Other"
  purity: number; // per-mille; 0 for non-gold material
  grossMg: number;
  fineMg: number;
  expectedReturnDate?: string; // only meaningful for "issue"
  remarks?: string;
  referencePhotoDataUrl?: string; // only meaningful for "receive"
  ledgerEntryId?: string;

  // ── Extension points — reserved, not implemented in this phase ────────
  /** Future: link to the gold settlement this transaction was settled under. */
  goldSettlementId?: string;
  /** Future: link to the manufacturing bill this issue's cost eventually rolls into. */
  manufacturingBillId?: string;
  /** Future: QR payload/token for scan-based tracking of this transaction. */
  qrCode?: string;
  /** Future: barcode identifier if this transaction gets its own printed label. */
  barcodeId?: string;
  /** Future: whether an automated communication was sent for this transaction. */
  communicationSent?: boolean;
  /** Future: sync identifier once a Dealer/Karigar portal can see this transaction. */
  portalSyncId?: string;
}

const outsideWorkRepository = createRepository<OutsideWorkTransaction>("outside_work_transactions");

// Guards a rapid double-click/double-submit from creating two identical
// transactions for the same jeweller before React's disabled state commits —
// same class of race fixed in order-issue-store.ts / worker-return-store.ts /
// polishing-store.ts's add().
const addInFlight = new Set<string>();

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `owt_${crypto.randomUUID()}`;
  return `owt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

interface OutsideWorkState {
  transactions: OutsideWorkTransaction[];
  refresh: () => Promise<void>;
  add: (
    input: Omit<OutsideWorkTransaction, "id" | "ts" | "txnNo">,
  ) => Promise<OutsideWorkTransaction>;
  forJeweller: (jewellerId: string) => OutsideWorkTransaction[];
  forOrder: (orderId: string) => OutsideWorkTransaction[];
  /** Stamps this transaction as consumed by a Manufacturing Bill — guards
   *  against a later auto-collect pass double-counting it. */
  linkToManufacturingBill: (id: string, billId: string) => Promise<void>;
  reset: () => void;
}

export const useOutsideWork = create<OutsideWorkState>()((set, get) => ({
  transactions: [],
  refresh: async () => set({ transactions: await outsideWorkRepository.readAll() }),
  add: async (input) => {
    const inFlightKey = `${input.jewellerId}:${input.type}:${input.orderId ?? ""}`;
    if (addInFlight.has(inFlightKey)) {
      throw new Error("An Outside Work transaction for this jeweller is already being saved.");
    }
    addInFlight.add(inFlightKey);
    try {
      const now = Date.now();
      const d = new Date(now);
      const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
      const txnNo = await nextDocumentNumber(`outside_work:${input.type}:${ymd}`, `OW-${ymd}-`, 3);
      const txn: OutsideWorkTransaction = { ...input, id: makeId(), txnNo, ts: now };
      await outsideWorkRepository.save(txn);
      set((s) => ({ transactions: [txn, ...s.transactions] }));
      // Best-effort audit trail — a logging failure never blocks the posting.
      try {
        const [{ append: appendAudit }, { supabase: sb }] = await Promise.all([
          import("./security/audit-log"),
          import("@/integrations/supabase/client"),
        ]);
        const { data } = await sb.auth.getSession();
        await appendAudit({
          actorId: data.session?.user.id ?? null,
          actorEmail: data.session?.user.email ?? null,
          action: `outside_work.${txn.type}`,
          entityType: "outside_work_transactions",
          entityId: txn.id,
          before: null,
          after: txn,
          deviceId: null,
        });
      } catch (err) {
        console.error("[OutsideWork] Failed to audit-log transaction:", err);
      }
      return txn;
    } finally {
      addInFlight.delete(inFlightKey);
    }
  },
  forJeweller: (jewellerId) =>
    get()
      .transactions.filter((t) => t.jewellerId === jewellerId)
      .sort((a, b) => b.ts - a.ts),
  forOrder: (orderId) =>
    get()
      .transactions.filter((t) => t.orderId === orderId)
      .sort((a, b) => b.ts - a.ts),
  linkToManufacturingBill: async (id, billId) => {
    const txn = get().transactions.find((t) => t.id === id);
    if (!txn || txn.manufacturingBillId) return;
    const updated: OutsideWorkTransaction = { ...txn, manufacturingBillId: billId };
    await outsideWorkRepository.save(updated);
    set((s) => ({ transactions: s.transactions.map((t) => (t.id === id ? updated : t)) }));
  },
  reset: () => set({ transactions: [] }),
}));

export const COMMON_OUTSIDE_WORK_MATERIALS = [
  "Gold",
  "Chain",
  "Ball",
  "KDM",
  "Wire",
  "Finding",
  "Other",
] as const;

/** Material options on the receive side — a returned item is usually a
 *  finished product, but may also be leftover raw gold, scrap, or filings. */
export const COMMON_OUTSIDE_RETURN_MATERIALS = [
  "Finished Product",
  "Gold",
  "Scrap",
  "Filings",
  "Other",
] as const;

export interface OutsideWorkPosition {
  totalIssuedFineMg: number;
  totalReturnedFineMg: number;
  pendingGoldFineMg: number;
  /** Non-gold material still outstanding, gross weight (mg) — a single aggregate across all non-gold material types, per spec ("Pending Material" as one figure, not a per-material breakdown). */
  pendingMaterialGrossMg: number;
  lastTransactionTs: number | null;
}

/**
 * Visibility-only running position for one outside jeweller (or, scoped to
 * one Production Order's outside-work transactions). No settlement math —
 * wastage/recovery/over-loss are out of scope for this phase, same as the
 * Worker Return workflow.
 */
export function computeOutsideWorkPosition(txns: OutsideWorkTransaction[]): OutsideWorkPosition {
  let totalIssuedFineMg = 0;
  let totalReturnedFineMg = 0;
  let pendingMaterialGrossMg = 0;
  let lastTransactionTs: number | null = null;

  for (const t of txns) {
    if (lastTransactionTs === null || t.ts > lastTransactionTs) lastTransactionTs = t.ts;
    const isGold = t.materialType === "Gold";
    if (t.type === "issue") {
      if (isGold) totalIssuedFineMg += t.fineMg;
      else pendingMaterialGrossMg += t.grossMg;
    } else {
      if (isGold) totalReturnedFineMg += t.fineMg;
      else pendingMaterialGrossMg -= t.grossMg;
    }
  }

  return {
    totalIssuedFineMg,
    totalReturnedFineMg,
    pendingGoldFineMg: Math.max(0, totalIssuedFineMg - totalReturnedFineMg),
    pendingMaterialGrossMg: Math.max(0, pendingMaterialGrossMg),
    lastTransactionTs,
  };
}
