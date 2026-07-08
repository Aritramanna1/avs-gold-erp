/**
 * Lot / Batch Management (Priority 5) — groups stock items (e.g. items
 * manufactured together, or received in one purchase lot) so they can be
 * tracked, reconciled, and reported on as a unit. Additive companion to
 * stock-store.ts, same linkage pattern as stone-tracking-store.ts (a
 * separate table referencing stock item ids, not new fields on StockItem).
 */
import { create } from "zustand";
import { createRepository } from "./repositories/base-repository";
import { useStock } from "./stock-store";

export type LotStatus = "open" | "closed";

export interface LotBatch {
  id: string;
  batchNo: string;
  category: string;
  purity: number;
  itemIds: string[];
  status: LotStatus;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  closedAt?: number;
}

interface LotBatchState {
  batches: LotBatch[];
  refresh: () => Promise<void>;
  create: (
    b: Omit<LotBatch, "id" | "createdAt" | "updatedAt" | "status" | "itemIds"> & {
      id?: string;
      itemIds?: string[];
    },
  ) => Promise<LotBatch>;
  addItem: (batchId: string, stockItemId: string) => Promise<void>;
  removeItem: (batchId: string, stockItemId: string) => Promise<void>;
  close: (batchId: string) => Promise<void>;
  reset: () => void;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `lot_${crypto.randomUUID()}`;
  return `lot_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

const lotRepository = createRepository<LotBatch>("lot_batches");

export const useLotBatches = create<LotBatchState>()((set, get) => ({
  batches: [],
  refresh: async () => {
    const all = await lotRepository.readAll();
    set({ batches: all });
  },
  create: async (input) => {
    const now = Date.now();
    const batch: LotBatch = {
      id: input.id ?? makeId(),
      batchNo: input.batchNo,
      category: input.category,
      purity: input.purity,
      itemIds: input.itemIds ?? [],
      status: "open",
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };
    await lotRepository.save(batch);
    set((s) => ({ batches: [batch, ...s.batches] }));
    return batch;
  },
  addItem: async (batchId, stockItemId) => {
    const batch = get().batches.find((b) => b.id === batchId);
    if (!batch || batch.status !== "open") return;
    if (batch.itemIds.includes(stockItemId)) return;
    const updated = { ...batch, itemIds: [...batch.itemIds, stockItemId], updatedAt: Date.now() };
    await lotRepository.save(updated);
    set((s) => ({ batches: s.batches.map((b) => (b.id === batchId ? updated : b)) }));
  },
  removeItem: async (batchId, stockItemId) => {
    const batch = get().batches.find((b) => b.id === batchId);
    if (!batch || batch.status !== "open") return;
    const updated = {
      ...batch,
      itemIds: batch.itemIds.filter((id) => id !== stockItemId),
      updatedAt: Date.now(),
    };
    await lotRepository.save(updated);
    set((s) => ({ batches: s.batches.map((b) => (b.id === batchId ? updated : b)) }));
  },
  close: async (batchId) => {
    const batch = get().batches.find((b) => b.id === batchId);
    if (!batch || batch.status === "closed") return;
    const updated: LotBatch = { ...batch, status: "closed", closedAt: Date.now(), updatedAt: Date.now() };
    await lotRepository.save(updated);
    set((s) => ({ batches: s.batches.map((b) => (b.id === batchId ? updated : b)) }));
  },
  reset: () => set({ batches: [] }),
}));

export interface LotBatchTotals {
  itemCount: number;
  totalGrossMg: number;
  totalFineMg: number;
}

/** Aggregate weight totals for a batch, computed live from stock-store's current item data (not duplicated/cached on the batch itself, so it's always accurate even if an item's weight is later corrected). */
export function getLotBatchTotals(batch: LotBatch): LotBatchTotals {
  const items = useStock.getState().items.filter((i) => batch.itemIds.includes(i.id));
  return {
    itemCount: items.length,
    totalGrossMg: items.reduce((s, i) => s + i.grossMg, 0),
    totalFineMg: items.reduce((s, i) => s + i.fineMg, 0),
  };
}
