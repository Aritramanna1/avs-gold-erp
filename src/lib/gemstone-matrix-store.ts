/**
 * ORNEXA — Gemstone, Diamond Sieve & 4C Matrix Store
 * Authoritative Specification: docs/MASTER/ITEM_AND_MATERIAL_MASTER.md
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DiamondClarity =
  "FL" | "IF" | "VVS1" | "VVS2" | "VS1" | "VS2" | "SI1" | "SI2" | "I1" | "I2" | "I3";

export type DiamondColor =
  "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M" | "N_Z" | "FANCY";

export type DiamondCut = "EXCELLENT" | "VERY_GOOD" | "GOOD" | "FAIR" | "POOR";

export type DiamondSieveSize =
  | "-2"
  | "+2-6.5 (Stars)"
  | "+6.5-11 (Melee)"
  | "+11-14"
  | "+14-17 (Pointers)"
  | "1/5 ct"
  | "1/4 ct"
  | "1/3 ct"
  | "1/2 ct"
  | "1 ct+ Solitaire";

export interface DiamondRateMatrixEntry {
  id: string;
  sieveSize: DiamondSieveSize;
  clarity: DiamondClarity;
  color: DiamondColor;
  cut: DiamondCut;
  ratePerCaratPaise: number;
  effectiveFrom: string;
}

export interface GemstoneCategoryMaster {
  id: string;
  code: string;
  name: string;
  hardnessMohs: number;
  specificGravity: number;
  refractiveIndex: string;
  defaultUnit: "carats" | "grams" | "ratti";
  ratePerUnitPaise: number;
}

export const CANONICAL_GEMSTONES: GemstoneCategoryMaster[] = [
  {
    id: "gem_ruby",
    code: "RUBY",
    name: "Natural Ruby (Manik)",
    hardnessMohs: 9.0,
    specificGravity: 4.0,
    refractiveIndex: "1.762-1.770",
    defaultUnit: "carats",
    ratePerUnitPaise: 450000,
  },
  {
    id: "gem_emerald",
    code: "EMERALD",
    name: "Natural Emerald (Panna)",
    hardnessMohs: 7.5,
    specificGravity: 2.76,
    refractiveIndex: "1.577-1.583",
    defaultUnit: "carats",
    ratePerUnitPaise: 380000,
  },
  {
    id: "gem_blue_sapphire",
    code: "BLUE_SAPPHIRE",
    name: "Natural Blue Sapphire (Neelam)",
    hardnessMohs: 9.0,
    specificGravity: 4.0,
    refractiveIndex: "1.762-1.770",
    defaultUnit: "carats",
    ratePerUnitPaise: 650000,
  },
  {
    id: "gem_yellow_sapphire",
    code: "YELLOW_SAPPHIRE",
    name: "Natural Yellow Sapphire (Pukhraj)",
    hardnessMohs: 9.0,
    specificGravity: 4.0,
    refractiveIndex: "1.762-1.770",
    defaultUnit: "carats",
    ratePerUnitPaise: 320000,
  },
  {
    id: "gem_natural_pearl",
    code: "PEARL",
    name: "Natural South Sea Pearl (Moti)",
    hardnessMohs: 3.5,
    specificGravity: 2.71,
    refractiveIndex: "1.530-1.685",
    defaultUnit: "carats",
    ratePerUnitPaise: 180000,
  },
  {
    id: "gem_cubic_zirconia",
    code: "CZ_SWAROVSKI",
    name: "Cubic Zirconia / Signity Star",
    hardnessMohs: 8.5,
    specificGravity: 5.8,
    refractiveIndex: "2.15-2.18",
    defaultUnit: "carats",
    ratePerUnitPaise: 1500,
  },
];

interface GemstoneMatrixStore {
  gemstones: GemstoneCategoryMaster[];
  diamondRates: DiamondRateMatrixEntry[];
  lookupDiamondRate: (
    sieve: DiamondSieveSize,
    clarity: DiamondClarity,
    color: DiamondColor,
  ) => number;
  updateDiamondRate: (entry: DiamondRateMatrixEntry) => void;
  updateGemstone: (id: string, patch: Partial<GemstoneCategoryMaster>) => void;
}

export const useGemstoneMatrix = create<GemstoneMatrixStore>()(
  persist(
    (set, get) => ({
      gemstones: CANONICAL_GEMSTONES,
      diamondRates: [
        {
          id: "dr_1",
          sieveSize: "+6.5-11 (Melee)",
          clarity: "VVS1",
          color: "G",
          cut: "EXCELLENT",
          ratePerCaratPaise: 4500000, // ₹45,000 / ct
          effectiveFrom: "2026-04-01",
        },
        {
          id: "dr_2",
          sieveSize: "+6.5-11 (Melee)",
          clarity: "VS1",
          color: "H",
          cut: "VERY_GOOD",
          ratePerCaratPaise: 3800000, // ₹38,000 / ct
          effectiveFrom: "2026-04-01",
        },
        {
          id: "dr_3",
          sieveSize: "+6.5-11 (Melee)",
          clarity: "SI1",
          color: "I",
          cut: "GOOD",
          ratePerCaratPaise: 2900000, // ₹29,000 / ct
          effectiveFrom: "2026-04-01",
        },
      ],

      lookupDiamondRate: (sieve, clarity, color) => {
        const entry = get().diamondRates.find(
          (r) => r.sieveSize === sieve && r.clarity === clarity && r.color === color,
        );
        return entry ? entry.ratePerCaratPaise : 3500000; // fallback standard rate
      },

      updateDiamondRate: (entry) => {
        set((s) => ({
          diamondRates: [...s.diamondRates.filter((r) => r.id !== entry.id), entry],
        }));
      },

      updateGemstone: (id, patch) => {
        set((s) => ({
          gemstones: s.gemstones.map((g) => (g.id === id ? { ...g, ...patch } : g)),
        }));
      },
    }),
    {
      name: "ornexa-gemstone-matrix-v1",
    },
  ),
);
