/**
 * Stone / Diamond Tracking (Priority 5) — additive companion to
 * stock-store.ts's StockItem, same pattern as attachments-store.ts (a
 * separate table linked by `stockItemId`, not new fields bolted onto the
 * already-widely-used StockItem interface). One StockItem can carry
 * multiple stone entries (e.g. a ring with both a center diamond and
 * accent stones), each optionally carrying a certificate reference —
 * "Diamond Certificates" is satisfied by certificateNumber/Authority
 * fields here rather than a separate certificate-tracking subsystem,
 * since a certificate is always issued FOR a specific stone.
 */
import { create } from "zustand";
import { createRepository } from "./repositories/base-repository";
import { fetchStoneDetails } from "./stone-query";

export type StoneType =
  "diamond" | "ruby" | "emerald" | "sapphire" | "pearl" | "cubic_zirconia" | "other";

export const STONE_TYPE_LABELS: Record<StoneType, string> = {
  diamond: "Diamond",
  ruby: "Ruby",
  emerald: "Emerald",
  sapphire: "Sapphire",
  pearl: "Pearl",
  cubic_zirconia: "Cubic Zirconia",
  other: "Other",
};

export interface StoneDetail {
  id: string;
  stockItemId: string;
  stoneType: StoneType;
  count: number;
  totalWeightCt: number; // carats
  clarity?: string; // e.g. "VS1", "SI2"
  color?: string; // e.g. "G", "H"
  cut?: string; // e.g. "Round Brilliant"
  certificateNumber?: string;
  certificateAuthority?: string; // e.g. "GIA", "IGI"
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

interface StoneTrackingState {
  details: StoneDetail[];
  refresh: () => Promise<void>;
  add: (
    d: Omit<StoneDetail, "id" | "createdAt" | "updatedAt"> & { id?: string },
  ) => Promise<StoneDetail>;
  update: (id: string, patch: Partial<StoneDetail>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  forStockItem: (stockItemId: string) => StoneDetail[];
  reset: () => void;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return `stone_${crypto.randomUUID()}`;
  return `stone_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

const stoneRepository = createRepository<StoneDetail>("stone_details");

export const useStoneTracking = create<StoneTrackingState>()((set, get) => ({
  details: [],
  refresh: async () => {
    const all = await fetchStoneDetails();
    set({ details: all });
  },
  add: async (input) => {
    const now = Date.now();
    const detail: StoneDetail = {
      id: input.id ?? makeId(),
      createdAt: now,
      updatedAt: now,
      ...input,
    };
    await stoneRepository.save(detail);
    set((s) => ({ details: [detail, ...s.details] }));
    return detail;
  },
  update: async (id, patch) => {
    const current = get().details.find((d) => d.id === id);
    if (!current) return;
    const updated = { ...current, ...patch, updatedAt: Date.now() };
    await stoneRepository.save(updated);
    set((s) => ({ details: s.details.map((d) => (d.id === id ? updated : d)) }));
  },
  remove: async (id) => {
    await stoneRepository.delete(id);
    set((s) => ({ details: s.details.filter((d) => d.id !== id) }));
  },
  forStockItem: (stockItemId) => get().details.filter((d) => d.stockItemId === stockItemId),
  reset: () => set({ details: [] }),
}));
