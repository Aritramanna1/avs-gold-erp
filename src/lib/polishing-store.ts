/**
 * Polishing workflow — digitizes the existing paper Polishing Register.
 * Deliberately NOT a manufacturing workflow engine: polishing is an
 * optional business process (gated by the `enable_polishing_module`
 * business rule), a Production Order link is optional, and there is no
 * step/status state machine here — just two transaction types (Send /
 * Receive) that mirror worker-gold-book-store.ts's order-linked issue
 * entries and worker-return-store.ts's already-established pattern exactly,
 * so the same "one action, every
 * ledger updates automatically, no duplicates" guarantee applies here too.
 *
 * Gold Ledger integration: reuses the existing `karigar` bucket (gold
 * currently outside the vault, with a third party doing work on it) rather
 * than adding a new bucket — a polisher is, for balance-sheet purposes,
 * exactly that: a party temporarily holding the shop's gold. This avoids
 * any change to ledger.tsx's Balance Sheet UI or Reports, both explicitly
 * out of scope for this phase.
 */
import { create } from "zustand";
import { createRepository } from "./repositories/base-repository";
import { append as appendAuditEntry } from "./security/audit-log";
import { nextDocumentNumber } from "./document-numbering";

export type PolishingTransactionType = "sent" | "received";

export interface PolishingTransaction {
  id: string;
  txnNo: string;
  ts: number;
  type: PolishingTransactionType;
  polisherId: string;
  polisherName: string;
  orderId?: string;
  orderNo?: string;
  product: string;
  grossMg: number;
  purity: number;
  fineMg: number;
  /** Sent only. */
  expectedReturnDate?: string;
  /** Received only. */
  polishingChargesPaise?: number;
  /** Received only. */
  referencePhotoDataUrl?: string;
  remarks?: string;
  ledgerEntryId?: string;
  /** Set when require_approval_before_{sending,receiving}_polishing was on at the time. */
  approvedBy?: string;
  /** Best-effort link from a Receive transaction back to the Send it is settling — the oldest still-pending Send for that polisher at the time of receipt. Informational only, not a hard FK. */
  relatedSentId?: string;

  // ── Future extension points — reserved, NOT implemented in this phase ──
  barcodeId?: string;
  qrCode?: string;
  manufacturingBillId?: string;
  goldSettlementId?: string;
  communicationSent?: boolean;
  customerPortalVisible?: boolean;
}

const polishingRepository = createRepository<PolishingTransaction>("polishing_transactions");

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `pol_${crypto.randomUUID()}`;
  return `pol_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export interface PolisherLedgerRow {
  polisherId: string;
  polisherName: string;
  totalIssuedFineMg: number;
  totalReturnedFineMg: number;
  pendingFineMg: number;
  currentJobs: number;
  lastTransactionTs: number | null;
}

export interface PolishingCurrentPosition {
  goldSentFineMg: number;
  goldReturnedFineMg: number;
  pendingFineMg: number;
  pendingJobs: number;
  lastActivityTs: number | null;
}

/** Per-polisher summary — Total Issued/Returned/Pending/Current Jobs/Last Transaction. */
export function computePolisherLedger(transactions: PolishingTransaction[]): PolisherLedgerRow[] {
  const byPolisher = new Map<string, PolishingTransaction[]>();
  for (const t of transactions) {
    const list = byPolisher.get(t.polisherId) ?? [];
    list.push(t);
    byPolisher.set(t.polisherId, list);
  }
  return Array.from(byPolisher.entries())
    .map(([polisherId, txs]) => {
      const sent = txs.filter((t) => t.type === "sent");
      const received = txs.filter((t) => t.type === "received");
      const totalIssuedFineMg = sent.reduce((s, t) => s + t.fineMg, 0);
      const totalReturnedFineMg = received.reduce((s, t) => s + t.fineMg, 0);
      const lastTs = txs.reduce((max, t) => Math.max(max, t.ts), 0);
      return {
        polisherId,
        polisherName: txs[0]?.polisherName ?? "Unknown",
        totalIssuedFineMg,
        totalReturnedFineMg,
        pendingFineMg: Math.max(0, totalIssuedFineMg - totalReturnedFineMg),
        // "Current jobs" — count of Send transactions not yet matched by a
        // Receive for this polisher. A simple count-difference, not a
        // per-job state machine (this phase deliberately has none).
        currentJobs: Math.max(0, sent.length - received.length),
        lastTransactionTs: lastTs || null,
      };
    })
    .sort((a, b) => (b.lastTransactionTs ?? 0) - (a.lastTransactionTs ?? 0));
}

/** Shop-wide Current Position — Gold Sent/Returned/Pending/Pending Jobs/Last Activity. */
export function computeCurrentPosition(
  transactions: PolishingTransaction[],
): PolishingCurrentPosition {
  const sent = transactions.filter((t) => t.type === "sent");
  const received = transactions.filter((t) => t.type === "received");
  const goldSentFineMg = sent.reduce((s, t) => s + t.fineMg, 0);
  const goldReturnedFineMg = received.reduce((s, t) => s + t.fineMg, 0);
  const lastActivityTs = transactions.reduce((max, t) => Math.max(max, t.ts), 0) || null;
  return {
    goldSentFineMg,
    goldReturnedFineMg,
    pendingFineMg: Math.max(0, goldSentFineMg - goldReturnedFineMg),
    pendingJobs: Math.max(0, sent.length - received.length),
    lastActivityTs,
  };
}

/** Order-scoped Send/Receive history, oldest-first — used to auto-link a Receive to the oldest pending Send for that polisher against this order. */
export function findOldestPendingSend(
  transactions: PolishingTransaction[],
  polisherId: string,
  orderId: string | undefined,
): PolishingTransaction | undefined {
  const sent = transactions
    .filter((t) => t.type === "sent" && t.polisherId === polisherId && t.orderId === orderId)
    .sort((a, b) => a.ts - b.ts);
  const received = transactions.filter(
    (t) => t.type === "received" && t.polisherId === polisherId && t.orderId === orderId,
  );
  const settledIds = new Set(received.map((r) => r.relatedSentId).filter(Boolean));
  return sent.find((s) => !settledIds.has(s.id));
}

interface PolishingState {
  transactions: PolishingTransaction[];
  refresh: () => Promise<void>;
  add: (
    input: Omit<PolishingTransaction, "id" | "ts" | "txnNo">,
    actor?: { id: string | null; email: string | null },
  ) => Promise<PolishingTransaction>;
  forOrder: (orderId: string) => PolishingTransaction[];
  /** Stamps this transaction as consumed by a Manufacturing Bill — guards
   *  against a later auto-collect pass double-counting its charge. */
  linkToManufacturingBill: (id: string, billId: string) => Promise<void>;
  reset: () => void;
}

// Guards a rapid double-click/double-submit from creating two identical
// send/receive transactions for the same order+polisher before React's
// disabled state commits — same class of race fixed in
// manufacturing-barcode-store.ts's generate().
const addInFlight = new Set<string>();

export const usePolishing = create<PolishingState>()((set, get) => ({
  transactions: [],
  refresh: async () => set({ transactions: await polishingRepository.readAll() }),
  add: async (input, actor) => {
    const inFlightKey = `${input.orderId ?? ""}:${input.polisherId}:${input.type}`;
    if (addInFlight.has(inFlightKey)) {
      throw new Error("A polishing transaction for this order/polisher is already being saved.");
    }
    addInFlight.add(inFlightKey);
    try {
      const now = Date.now();
      const d = new Date(now);
      const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
      const txnNo = await nextDocumentNumber(`polishing:${input.type}:${ymd}`, `POL-${ymd}-`, 3);
      const tx: PolishingTransaction = { ...input, id: makeId(), txnNo, ts: now };
      await polishingRepository.save(tx);
      set((s) => ({ transactions: [tx, ...s.transactions] }));
      await appendAuditEntry({
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? null,
        action: `polishing.${tx.type}`,
        entityType: "polishing_transactions",
        entityId: tx.id,
        before: null,
        after: tx,
        deviceId: null,
      });
      return tx;
    } finally {
      addInFlight.delete(inFlightKey);
    }
  },
  forOrder: (orderId) =>
    get()
      .transactions.filter((t) => t.orderId === orderId)
      .sort((a, b) => b.ts - a.ts),
  linkToManufacturingBill: async (id, billId) => {
    const tx = get().transactions.find((t) => t.id === id);
    if (!tx || tx.manufacturingBillId) return;
    const updated: PolishingTransaction = { ...tx, manufacturingBillId: billId };
    await polishingRepository.save(updated);
    set((s) => ({ transactions: s.transactions.map((t) => (t.id === id ? updated : t)) }));
  },
  reset: () => set({ transactions: [] }),
}));
