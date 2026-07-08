/**
 * Hallmark Lifecycle.
 *
 * A HallmarkBatch is a set of finished stock items sent together to a BIS
 * assay/hallmarking center. Its lifecycle: sent -> (partially_received |
 * received) -> closed, or an item within it individually marked rejected.
 * Receiving an item back writes its HUID onto the linked StockItem
 * (stock-store.ts already has an optional `huid` field) — this store adds
 * the batch/lifecycle wrapper around that existing field, it does not
 * duplicate it.
 */
import { create } from "zustand";
import { createRepository } from "./repositories/base-repository";
import { useStock } from "./stock-store";
import { append as appendAudit } from "./security/audit-log";

export type HallmarkBatchStatus = "sent" | "partially_received" | "received" | "closed";
export type HallmarkItemStatus = "pending" | "received" | "rejected";

export interface HallmarkBatchLine {
  itemId: string;
  itemCode: string;
  status: HallmarkItemStatus;
  huid?: string;
  rejectionReason?: string;
}

export interface HallmarkBatch {
  id: string;
  branchId: string;
  batchNumber: string;
  status: HallmarkBatchStatus;
  assayCenterName: string;
  sentAt: number;
  closedAt?: number;
  lines: HallmarkBatchLine[];
  notes?: string;
}

interface HallmarkState {
  batches: HallmarkBatch[];
  setAll: (batches: HallmarkBatch[]) => void;
  send: (input: {
    branchId: string;
    assayCenterName: string;
    itemIds: string[];
    notes?: string;
  }) => Promise<HallmarkBatch>;
  receiveItem: (
    batchId: string,
    itemId: string,
    huid: string,
    actor: { id: string | null; email: string | null },
  ) => Promise<void>;
  rejectItem: (batchId: string, itemId: string, reason: string) => Promise<void>;
  close: (batchId: string) => Promise<void>;
  nextBatchNumber: (branchId: string) => string;
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `hm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function recomputeStatus(lines: HallmarkBatchLine[]): HallmarkBatchStatus {
  const resolved = lines.filter((l) => l.status !== "pending").length;
  if (resolved === 0) return "sent";
  if (resolved < lines.length) return "partially_received";
  return "received";
}

const hallmarkRepository = createRepository<HallmarkBatch>("hallmark_batches");

export const useHallmarkBatches = create<HallmarkState>()((set, get) => ({
  batches: [],
  setAll: (batches) => set({ batches }),
  nextBatchNumber: (branchId) => {
    const year = new Date().getFullYear();
    const head = `HM-${year}-`;
    const nums = get()
      .batches.filter((b) => b.branchId === branchId)
      .map((b) => b.batchNumber)
      .filter((c) => c.startsWith(head))
      .map((c) => Number(c.slice(head.length)))
      .filter((n) => Number.isFinite(n));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return `${head}${String(next).padStart(4, "0")}`;
  },
  send: async ({ branchId, assayCenterName, itemIds, notes }) => {
    const stockItems = useStock.getState().items;
    const lines: HallmarkBatchLine[] = itemIds.map((id) => {
      const item = stockItems.find((i) => i.id === id);
      return { itemId: id, itemCode: item?.itemCode ?? id, status: "pending" as const };
    });
    const batch: HallmarkBatch = {
      id: makeId(),
      branchId,
      batchNumber: get().nextBatchNumber(branchId),
      status: "sent",
      assayCenterName,
      sentAt: Date.now(),
      lines,
      notes,
    };
    set({ batches: [batch, ...get().batches] });
    await hallmarkRepository.save(batch);
    return batch;
  },
  receiveItem: async (batchId, itemId, huid, actor) => {
    const batch = get().batches.find((b) => b.id === batchId);
    if (!batch) return;
    const lines = batch.lines.map((l) => (l.itemId === itemId ? { ...l, status: "received" as const, huid } : l));
    const updated: HallmarkBatch = { ...batch, lines, status: recomputeStatus(lines) };
    set({ batches: get().batches.map((b) => (b.id === batchId ? updated : b)) });
    await hallmarkRepository.save(updated);
    await useStock.getState().update(itemId, { huid });
    void appendAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "hallmark_batches.receive_item",
      entityType: "hallmark_batches",
      entityId: batchId,
      before: { itemId, status: "pending" },
      after: { itemId, status: "received", huid },
    });
  },
  rejectItem: async (batchId, itemId, reason) => {
    const batch = get().batches.find((b) => b.id === batchId);
    if (!batch) return;
    const lines = batch.lines.map((l) =>
      l.itemId === itemId ? { ...l, status: "rejected" as const, rejectionReason: reason } : l,
    );
    const updated: HallmarkBatch = { ...batch, lines, status: recomputeStatus(lines) };
    set({ batches: get().batches.map((b) => (b.id === batchId ? updated : b)) });
    await hallmarkRepository.save(updated);
  },
  close: async (batchId) => {
    const batch = get().batches.find((b) => b.id === batchId);
    if (!batch) return;
    const updated: HallmarkBatch = { ...batch, status: "closed", closedAt: Date.now() };
    set({ batches: get().batches.map((b) => (b.id === batchId ? updated : b)) });
    await hallmarkRepository.save(updated);
  },
}));

export async function loadHallmarkBatches(): Promise<void> {
  const all = await hallmarkRepository.readAll();
  useHallmarkBatches.getState().setAll(all);
}
