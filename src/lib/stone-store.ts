/**
 * Stone & Diamond Tracking.
 *
 * A StoneRecord tracks one set stone/diamond linked to a finished stock item
 * (stock-store.ts's StockItem, referenced loosely by itemId — same pattern
 * as lot-store.ts's lot membership) so certificate numbers, carat weight and
 * cost can be traced per-piece independent of the gold weight already
 * tracked on the item itself.
 */
import { create } from "zustand";
import { createRepository } from "./repositories/base-repository";

export type StoneType = "diamond" | "ruby" | "emerald" | "sapphire" | "pearl" | "other";
export const STONE_TYPE_LABELS: Record<StoneType, string> = {
  diamond: "Diamond",
  ruby: "Ruby",
  emerald: "Emerald",
  sapphire: "Sapphire",
  pearl: "Pearl",
  other: "Other",
};

export interface StoneRecord {
  id: string;
  branchId: string;
  itemId?: string; // linked stock item, once set into a piece
  stoneType: StoneType;
  count: number;
  caratWeight: number;
  clarity?: string;
  color?: string;
  cut?: string;
  certificateNumber?: string;
  certifyingLab?: string;
  purchaseCostPaise?: number;
  notes?: string;
  createdAt: number;
}

interface StoneState {
  stones: StoneRecord[];
  setAll: (stones: StoneRecord[]) => void;
  add: (input: Omit<StoneRecord, "id" | "createdAt">) => Promise<StoneRecord>;
  update: (id: string, patch: Partial<StoneRecord>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  linkToItem: (id: string, itemId: string) => Promise<void>;
  unlinkFromItem: (id: string) => Promise<void>;
  findByCertificate: (certNumber: string) => StoneRecord | undefined;
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `stone_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const stoneRepository = createRepository<StoneRecord>("stock_stones");

export const useStones = create<StoneState>()((set, get) => ({
  stones: [],
  setAll: (stones) => set({ stones }),
  add: async (input) => {
    const stone: StoneRecord = { id: makeId(), createdAt: Date.now(), ...input };
    set({ stones: [stone, ...get().stones] });
    await stoneRepository.save(stone);
    return stone;
  },
  update: async (id, patch) => {
    const stone = get().stones.find((s) => s.id === id);
    if (!stone) return;
    const updated = { ...stone, ...patch };
    set({ stones: get().stones.map((s) => (s.id === id ? updated : s)) });
    await stoneRepository.save(updated);
  },
  remove: async (id) => {
    set({ stones: get().stones.filter((s) => s.id !== id) });
    await stoneRepository.delete(id);
  },
  linkToItem: async (id, itemId) => {
    await get().update(id, { itemId });
  },
  unlinkFromItem: async (id) => {
    await get().update(id, { itemId: undefined });
  },
  findByCertificate: (certNumber) => {
    const needle = certNumber.trim().toLowerCase();
    if (!needle) return undefined;
    return get().stones.find((s) => (s.certificateNumber ?? "").toLowerCase() === needle);
  },
}));

export async function loadStones(): Promise<void> {
  const all = await stoneRepository.readAll();
  useStones.getState().setAll(all);
}

export function stonesForItem(itemId: string): StoneRecord[] {
  return useStones.getState().stones.filter((s) => s.itemId === itemId);
}
