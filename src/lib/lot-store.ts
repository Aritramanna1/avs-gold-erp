/**
 * Lot & Batch Management.
 *
 * A Lot groups finished-stock items received or manufactured together (e.g.
 * one hallmarking batch sent to the assay office, or one supplier delivery)
 * so they can be traced, aged, and closed out as a unit. Items reference
 * their lot via StockItem.lotId (stock-store.ts) — this store is the lot
 * header + membership roll-up; it does not duplicate item data.
 */
import { create } from "zustand";
import { createRepository } from "./repositories/base-repository";
import { useStock, type StockItem } from "./stock-store";

export type LotStatus = "open" | "closed";

export interface StockLot {
  id: string;
  branchId: string;
  lotNumber: string;
  status: LotStatus;
  source: "supplier_receipt" | "manufacturing" | "opening_stock" | "other";
  supplierOrKarigarName?: string;
  receivedAt: number;
  closedAt?: number;
  notes?: string;
}

interface LotState {
  lots: StockLot[];
  setAll: (lots: StockLot[]) => void;
  create: (input: Omit<StockLot, "id" | "status" | "receivedAt">) => Promise<StockLot>;
  close: (id: string) => Promise<void>;
  reopen: (id: string) => Promise<void>;
  nextLotNumber: (branchId: string) => string;
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `lot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const lotRepository = createRepository<StockLot>("stock_lots");

export const useLots = create<LotState>()((set, get) => ({
  lots: [],
  setAll: (lots) => set({ lots }),
  nextLotNumber: (branchId) => {
    const year = new Date().getFullYear();
    const head = `LOT-${year}-`;
    const nums = get()
      .lots.filter((l) => l.branchId === branchId)
      .map((l) => l.lotNumber)
      .filter((c) => c.startsWith(head))
      .map((c) => Number(c.slice(head.length)))
      .filter((n) => Number.isFinite(n));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return `${head}${String(next).padStart(4, "0")}`;
  },
  create: async (input) => {
    const lot: StockLot = {
      id: makeId(),
      status: "open",
      receivedAt: Date.now(),
      ...input,
    };
    set({ lots: [lot, ...get().lots] });
    await lotRepository.save(lot);
    return lot;
  },
  close: async (id) => {
    const lot = get().lots.find((l) => l.id === id);
    if (!lot || lot.status === "closed") return;
    const updated: StockLot = { ...lot, status: "closed", closedAt: Date.now() };
    set({ lots: get().lots.map((l) => (l.id === id ? updated : l)) });
    await lotRepository.save(updated);
  },
  reopen: async (id) => {
    const lot = get().lots.find((l) => l.id === id);
    if (!lot || lot.status === "open") return;
    const updated: StockLot = { ...lot, status: "open", closedAt: undefined };
    set({ lots: get().lots.map((l) => (l.id === id ? updated : l)) });
    await lotRepository.save(updated);
  },
}));

export async function loadLots(): Promise<void> {
  const all = await lotRepository.readAll();
  useLots.getState().setAll(all);
}

export interface LotSummary {
  lot: StockLot;
  items: StockItem[];
  totalFineMg: number;
  availableCount: number;
  soldCount: number;
}

/** Roll-up of every stock item currently linked to `lotId`, from the live stock-store. */
export function summarizeLot(lotId: string): {
  items: StockItem[];
  totalFineMg: number;
  availableCount: number;
  soldCount: number;
} {
  const items = useStock.getState().items.filter((i) => i.lotId === lotId);
  return {
    items,
    totalFineMg: items.reduce((sum, i) => sum + i.fineMg, 0),
    availableCount: items.filter((i) => i.status === "available").length,
    soldCount: items.filter((i) => i.status === "sold").length,
  };
}
