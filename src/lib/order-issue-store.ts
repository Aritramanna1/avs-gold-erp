/**
 * Gold / Material Issue workflow — issues gold or workshop material from the
 * vault to a worker, linked directly to a Production Order (not a Job Card).
 * A Production Order can have any number of issue transactions; each one is
 * an immutable record here plus a mirrored Gold Ledger entry and Worker Gold
 * Book entry (which is also what already computes each worker's per-material
 * balance — see worker-gold-book-store.ts's `getWorkerBalance().materialBalances`).
 *
 * Scope for this phase: issue only. Returns, wastage, recovery, polishing,
 * and manufacturing billing are NOT implemented here — see the reserved,
 * documented (but unused) fields on `OrderIssue` below, which is the same
 * "reserve the field, don't populate it yet" pattern job-card-engine.ts
 * already established for its own extension points.
 */
import { create } from "zustand";
import { createRepository } from "./repositories/base-repository";
import { useLedger } from "./ledger-store";
import { useWorkerGoldBook } from "./worker-gold-book-store";
import { useMaterialVault } from "./material-vault-store";
import { ISSUE_VAULT_MOVEMENT_TYPE } from "./material-vault-sync";
import { supabase } from "@/integrations/supabase/client";

export interface OrderIssue {
  id: string;
  orderId: string;
  ts: number;
  workerId: string;
  workerName: string;
  material: string; // e.g. "Gold", "KDM", "Ball", "Die", "Wire", "Other"
  purity: number; // per-mille; 0 for non-gold material
  grossMg: number;
  fineMg: number;
  remarks?: string;
  /** Reference photo (thumbnail data URL) of the gold/material issued — same optional-evidence pattern as OutsideWorkTransaction's referencePhotoDataUrl. */
  referencePhotoDataUrl?: string;
  /** Voucher/slip number for reprint — mirrors the linked Worker Gold Book entry's entryNo (already a concurrency-safe sequence via nextDocumentNumber), not a separately generated one. */
  slipNo?: string;
  ledgerEntryId?: string;
  workerGoldBookEntryId?: string;

  // ── Extension points — reserved, not implemented in this phase ────────
  /** Future: link back to the WorkerGoldBookEntry(s) recording this issue's return. */
  returnedEntryIds?: string[];
  /** Future: wastage recorded against this specific issue. */
  wastageMg?: number;
  /** Future: recovered/reclaimed fine gold credited back against this issue. */
  recoveryMg?: number;
  /** Future: link to a polishing pass performed on the item this issue funded. */
  polishingId?: string;
  /** Future: link to the manufacturing bill this issue's cost eventually rolls into. */
  manufacturingBillId?: string;
}

const orderIssueRepository = createRepository<OrderIssue>("order_issues");

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `oi_${crypto.randomUUID()}`;
  return `oi_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

interface OrderIssueState {
  issues: OrderIssue[];
  refresh: () => Promise<void>;
  add: (input: Omit<OrderIssue, "id" | "ts">) => Promise<OrderIssue>;
  forOrder: (orderId: string) => OrderIssue[];
  /** Stamps this issue as consumed by a Manufacturing Bill — the only guard
   *  against a bill re-collecting (double-counting) the same issue on a
   *  later auto-collect pass. */
  linkToManufacturingBill: (id: string, billId: string) => Promise<void>;
  reset: () => void;
}

// Guards a rapid double-click/double-submit from creating two identical
// issues for the same order+worker before React's disabled state commits —
// same class of race fixed in manufacturing-barcode-store.ts's generate().
const addInFlight = new Set<string>();

export const useOrderIssues = create<OrderIssueState>()((set, get) => ({
  issues: [],
  refresh: async () => set({ issues: await orderIssueRepository.readAll() }),
  add: async (input) => {
    const inFlightKey = `${input.orderId}:${input.workerId}`;
    if (addInFlight.has(inFlightKey)) {
      throw new Error("An issue for this order/worker is already being saved.");
    }
    addInFlight.add(inFlightKey);
    try {
      const issue: OrderIssue = { ...input, id: makeId(), ts: Date.now() };
      await orderIssueRepository.save(issue);
      set((s) => ({ issues: [issue, ...s.issues] }));
      return issue;
    } finally {
      addInFlight.delete(inFlightKey);
    }
  },
  forOrder: (orderId) =>
    get()
      .issues.filter((i) => i.orderId === orderId)
      .sort((a, b) => b.ts - a.ts),
  linkToManufacturingBill: async (id, billId) => {
    const issue = get().issues.find((i) => i.id === id);
    if (!issue || issue.manufacturingBillId) return;
    const updated: OrderIssue = { ...issue, manufacturingBillId: billId };
    await orderIssueRepository.save(updated);
    set((s) => ({ issues: s.issues.map((i) => (i.id === id ? updated : i)) }));
  },
  reset: () => set({ issues: [] }),
}));

export const COMMON_MATERIALS = ["Gold", "KDM", "Ball", "Die", "Wire", "Finding", "Other"];
