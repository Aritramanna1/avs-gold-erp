/**
 * MTJ ERP — Catalog / Design Library store
 * Designs used as references in Create Order.
 * Photo upload is a future capability; we keep only an optional data-URL placeholder.
 */
import { create } from "zustand";
import { createRepository } from "./repositories/base-repository";

export type DesignSource = "internal" | "customer_reference" | "external" | "saved_from_order";
export const DESIGN_SOURCE_LABELS: Record<DesignSource, string> = {
  internal: "Internal Catalog",
  customer_reference: "Customer Reference",
  external: "External / Supplier Reference",
  saved_from_order: "Saved From Orders",
};

export type Difficulty = "easy" | "medium" | "hard";
export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export interface Design {
  id: string;
  designNumber: string;
  designName: string;
  category: string;
  subcategory?: string;
  itemType?: string;
  purity: number; // per-mille
  approxGrossMg: number;
  approxNetMg: number;
  difficulty: Difficulty;
  tags: string[];
  source: DesignSource;
  customerId?: string;
  orderId?: string;
  notes?: string;
  photoDataUrl?: string;
  createdAt: number;
  updatedAt: number;
}

interface CatalogState {
  designs: Design[];
  add: (d: Omit<Design, "id" | "createdAt" | "updatedAt"> & { id?: string }) => Design;
  update: (id: string, patch: Partial<Design>) => void;
  remove: (id: string) => void;
  nextDesignNumber: (category?: string) => string;
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `d_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

import { persist } from "zustand/middleware";
import { DEFAULT_CATALOG_DESIGNS } from "./catalog-jewelry-art";

const catalogRepository = createRepository<Design>("catalog_designs");

export const useCatalog = create<CatalogState>()(
  persist(
    (set, get) => ({
      designs: [...DEFAULT_CATALOG_DESIGNS],
      add: (input) => {
        const now = Date.now();
        const d: Design = { id: input.id || makeId(), createdAt: now, updatedAt: now, ...input };
        set({ designs: [d, ...get().designs.filter((x) => x.id !== d.id)] });
        void catalogRepository.save(d);
        return d;
      },
      update: (id, patch) => {
        const updated = get().designs.map((d) =>
          d.id === id ? { ...d, ...patch, updatedAt: Date.now() } : d,
        );
        set({ designs: updated });
        const d = updated.find((x) => x.id === id);
        if (d) void catalogRepository.save(d);
      },
      remove: (id) => {
        set({ designs: get().designs.filter((d) => d.id !== id) });
        void catalogRepository.delete(id);
      },
      nextDesignNumber: (category) => {
        const prefix = (category?.[0] ?? "D").toUpperCase();
        const year = new Date().getFullYear();
        const head = `${prefix}-${year}-`;
        const nums = get()
          .designs.map((d) => d.designNumber)
          .filter((n) => n && n.startsWith(head))
          .map((n) => Number(n.slice(head.length)))
          .filter((n) => Number.isFinite(n));
        const next = (nums.length ? Math.max(...nums) : 0) + 1;
        return `${head}${String(next).padStart(3, "0")}`;
      },
    }),
    {
      name: "mtj-catalog-store-v2",
      partialize: (state) => ({ designs: state.designs }),
    },
  ),
);

export type WeightRangeFilter = "under_1g" | "1g_to_2g" | "2g_to_5g" | "above_5g" | "all";

export interface ShareableCatalogueConfig {
  id: string;
  title: string;
  publicToken: string;
  designIds: string[];
  weightFilter: WeightRangeFilter;
  purityFilter?: number;
  customerId?: string;
  r2MediaFolder?: string;
  viewCount: number;
  shortlistedDesignIds: string[];
  expiresAt?: string;
  createdAt: string;
}

export function filterDesignsByWeightRange(designs: Design[], filter: WeightRangeFilter): Design[] {
  switch (filter) {
    case "under_1g":
      return designs.filter((d) => d.approxNetMg < 1000);
    case "1g_to_2g":
      return designs.filter((d) => d.approxNetMg >= 1000 && d.approxNetMg <= 2000);
    case "2g_to_5g":
      return designs.filter((d) => d.approxNetMg > 2000 && d.approxNetMg <= 5000);
    case "above_5g":
      return designs.filter((d) => d.approxNetMg > 5000);
    case "all":
    default:
      return designs;
  }
}
