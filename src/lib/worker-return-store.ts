/**
 * Worker Return workflow — records material/gold physically handed back by
 * a worker against a Production Order (not a Job Card). Mirrors
 * worker-gold-book-store.ts's order-linked "given" entries exactly: a
 * Production Order can have any number of returns, each is an immutable
 * record here plus a mirrored Gold Ledger entry and Worker Gold Book entry,
 * and the actual gold-ledger/worker-gold-book updates are orchestrated by
 * the calling dialog (worker-return-dialog.tsx), not by this store — same
 * convention the Worker Issue flow (worker-issue-dialog.tsx) already
 * established.
 *
 * Scope for this phase: recording the return and simple issued/returned/
 * pending totals only. Wastage, recovery, over/loss, salary deduction, and
 * manufacturing billing are NOT calculated or settled here — see the
 * reserved, documented (but unused) extension-point fields on
 * `WorkerReturn` below, the same "reserve the field, don't populate it yet"
 * pattern used by job-card-engine.ts.
 */
import { create } from "zustand";
import { createRepository } from "./repositories/base-repository";
import { nextDocumentNumber } from "./document-numbering";
import { fetchWorkerReturns } from "./custody-flow-query";

export const COMMON_RETURN_MATERIALS = [
  "Finished Product",
  "Scrap",
  "Filings",
  "Leftover Gold",
  "Other",
] as const;
export type ReturnMaterialKind = (typeof COMMON_RETURN_MATERIALS)[number];

export interface WorkerReturn {
  id: string;
  returnNo: string;
  orderId: string;
  ts: number;
  workerId: string;
  workerName: string;
  materialReturned: string; // one of COMMON_RETURN_MATERIALS, kept as string like OrderIssue.material
  finishedProductDescription?: string;
  purity: number; // per-mille; 0 for non-gold material
  grossMg: number;
  fineMg: number;
  remarks?: string;
  referencePhotoDataUrl?: string;
  ledgerEntryId?: string;
  workerGoldBookEntryId?: string;
  /** The specific issue this return is settling against, if the caller resolved one. Purely informational in this phase. */
  relatedIssueId?: string;

  // ── Extension points — reserved, not implemented in this phase ─────────
  /** Future: wastage recorded against this specific return. */
  wastageMg?: number;
  /** Future: recovered/reclaimed fine gold credited on top of this return. */
  recoveryMg?: number;
  /** Future: over/loss penalty computed for this return. */
  overlossMg?: number;
  /** Future: link to a polishing pass performed before this return. */
  polishingId?: string;
  /** Future: link to the manufacturing bill this return eventually rolls into. */
  manufacturingBillId?: string;
  /** Future: link to a gold settlement record once this return is settled. */
  goldSettlementId?: string;
}

const workerReturnRepository = createRepository<WorkerReturn>("worker_returns");

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `wr_${crypto.randomUUID()}`;
  return `wr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

interface WorkerReturnState {
  returns: WorkerReturn[];
  refresh: () => Promise<void>;
  add: (input: Omit<WorkerReturn, "id" | "ts" | "returnNo">) => Promise<WorkerReturn>;
  forOrder: (orderId: string) => WorkerReturn[];
  /** Stamps this return as consumed by a Manufacturing Bill — guards against
   *  a later auto-collect pass double-counting it. */
  linkToManufacturingBill: (id: string, billId: string) => Promise<void>;
  reset: () => void;
}

// Guards a rapid double-click/double-submit from creating two identical
// returns for the same order+worker before React's disabled state commits —
// same class of race fixed in manufacturing-barcode-store.ts's generate().
// Cleared in `finally` so legitimate later returns for the same order are
// never blocked.
const addInFlight = new Set<string>();

export const useWorkerReturns = create<WorkerReturnState>()((set, get) => ({
  returns: [],
  refresh: async () => set({ returns: await fetchWorkerReturns() }),
  add: async (input) => {
    const inFlightKey = `${input.orderId}:${input.workerId}`;
    if (addInFlight.has(inFlightKey)) {
      throw new Error("A return for this order/worker is already being saved.");
    }
    addInFlight.add(inFlightKey);
    try {
      const now = Date.now();
      const d = new Date(now);
      const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
      const returnNo = await nextDocumentNumber(`worker_return:${ymd}`, `WR-${ymd}-`, 3);
      const ret: WorkerReturn = { ...input, id: makeId(), returnNo, ts: now };
      await workerReturnRepository.save(ret);
      set((s) => ({ returns: [ret, ...s.returns] }));
      return ret;
    } finally {
      addInFlight.delete(inFlightKey);
    }
  },
  forOrder: (orderId) =>
    get()
      .returns.filter((r) => r.orderId === orderId)
      .sort((a, b) => b.ts - a.ts),
  linkToManufacturingBill: async (id, billId) => {
    const ret = get().returns.find((r) => r.id === id);
    if (!ret || ret.manufacturingBillId) return;
    const updated: WorkerReturn = { ...ret, manufacturingBillId: billId };
    await workerReturnRepository.save(updated);
    set((s) => ({ returns: s.returns.map((r) => (r.id === id ? updated : r)) }));
  },
  reset: () => set({ returns: [] }),
}));

/**
 * Visibility-only gold position for a Production Order — no settlement math
 * (wastage/recovery/over-loss are deliberately excluded, per this phase's
 * scope). `issuedFineMg` is the caller's responsibility to supply (sum of
 * the order's issued fine gold, summed from worker-gold-book-store.ts's
 * order-linked "given" entries) so this store doesn't need to import
 * worker-gold-book-store.ts just to add two numbers together.
 */
export function computeGoldPosition(
  issuedFineMg: number,
  returns: WorkerReturn[],
): { issuedFineMg: number; returnedFineMg: number; pendingFineMg: number } {
  const returnedFineMg = returns.reduce((s, r) => s + r.fineMg, 0);
  return {
    issuedFineMg,
    returnedFineMg,
    pendingFineMg: Math.max(0, issuedFineMg - returnedFineMg),
  };
}
