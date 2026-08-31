/**
 * AVS ERP — Gold core utilities
 *
 * Internal storage rule:
 *   - weights are stored as **integer milligrams (mg)**
 *   - purity is stored as **per-mille integer** (e.g. 916 for 22K, 999 for fine, 750 for 18K)
 *   - money (when added later) is stored as **integer paise**
 *
 * Never store weights or money as floating point. Convert only at I/O boundaries
 * (display + parsing). All accounting math runs on integers.
 */

import { usePurityGradesStore } from "@/lib/purity-grades-store";

export type Purity = number; // per-mille, 0..999

/** Convert grams (user input) to integer mg. Accepts "100", "100.000", " 12.345 ". */
export function gramsToMg(input: string | number): number {
  if (typeof input === "number") {
    if (!Number.isFinite(input)) throw new Error("Invalid grams");
    return Math.round(input * 1000);
  }
  const s = String(input).trim();
  if (!s) return 0;
  if (!/^\d+(\.\d{0,3})?$/.test(s)) {
    throw new Error("Enter grams with up to 3 decimal places (e.g. 100.000)");
  }
  const [whole, frac = ""] = s.split(".");
  const fracPadded = (frac + "000").slice(0, 3);
  return Number(whole) * 1000 + Number(fracPadded);
}

/**
 * Convert mg → grams string. Default 3 decimals (exact mg ↔ g mapping).
 * `decimals` is display-only — never use the returned string for re-storage.
 */
export function mgToGrams(
  mg: number,
  opts: { sign?: boolean; decimals?: number } = {},
): string {
  if (typeof mg !== "number" || isNaN(mg) || !Number.isFinite(mg)) {
    return "0.000";
  }
  const decimals = Math.max(0, Math.min(6, opts.decimals ?? 3));
  const neg = mg < 0;
  const abs = Math.abs(mg);
  if (decimals === 3) {
    const whole = Math.floor(abs / 1000);
    const frac = (Math.round(abs) % 1000).toString().padStart(3, "0");
    const body = `${whole}.${frac}`;
    if (opts.sign && !neg && mg > 0) return `+${body}`;
    return neg ? `-${body}` : body;
  }
  // Scale to requested display decimals without mutating stored mg.
  const factor = 10 ** decimals;
  const scaled = abs / 1000;
  const rounded = Math.round(scaled * factor) / factor;
  const body = rounded.toFixed(decimals);
  if (opts.sign && !neg && mg > 0) return `+${body}`;
  return neg ? `-${body}` : body;
}

/** Fineness / metal-content denominator (‰ basis). Default 999 for historical shops. */
export type FinenessBasis = 995 | 999 | 1000;

export const DEFAULT_FINENESS_BASIS: FinenessBasis = 999;

export function normalizeFinenessBasis(raw: unknown): FinenessBasis {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (n === 995 || n === 999 || n === 1000) return n;
  return DEFAULT_FINENESS_BASIS;
}

/**
 * Inverse of fineGoldMg for metal-content method: gross ≈ fine × basis / purity.
 * Integer mg end-to-end. Basis comes from Customization (995 / 999 / 1000).
 */
export function grossFromFineMg(
  fineMg: number,
  purity: Purity,
  basis: FinenessBasis = DEFAULT_FINENESS_BASIS,
): number {
  if (!Number.isInteger(fineMg) || fineMg < 0) {
    throw new Error("fineMg must be non-negative integer");
  }
  if (!Number.isInteger(purity) || purity < 0 || purity > 999) {
    throw new Error("purity must be 0..999");
  }
  const b = normalizeFinenessBasis(basis);
  if (purity >= b || (b === 1000 && purity >= 999)) return fineMg;
  if (purity === 0) throw new Error("Cannot invert fine at purity 0");
  return Math.round((fineMg * b) / purity);
}

/** 1000 g = 1 kg, and weights are stored in mg, so 1 kg = 1,000,000 mg. */
const MG_PER_KG = 1_000_000;

/**
 * The ERP-wide standard for DISPLAYING a gold weight.
 *
 * Storage never changes — everything stays integer mg — this is purely the
 * I/O-boundary format. Below 1 kg it reads as grams ("840.500 g"); at or above
 * 1 kg it leads with kilograms and keeps the exact grams in parentheses
 * ("1.240 kg (1240.000 g)") so a shop that thinks in kg and one that thinks in
 * g both read the same figure without converting in their head.
 *
 * Use this wherever a weight is shown to a human. `mgToGrams()` remains for the
 * places that need a bare grams number (form inputs, PDF cells, CSV).
 */
export function formatWeight(mg: number, opts: { sign?: boolean } = {}): string {
  const abs = Math.abs(mg);
  const grams = mgToGrams(mg, opts);
  if (abs < MG_PER_KG) return `${grams} g`;
  // Kilograms to 3 dp, from the same integer mg — no float drift.
  const neg = mg < 0;
  const kgWhole = Math.floor(abs / MG_PER_KG);
  const kgFrac = Math.floor((abs % MG_PER_KG) / 1000)
    .toString()
    .padStart(3, "0");
  const sign = neg ? "-" : opts.sign && mg > 0 ? "+" : "";
  return `${sign}${kgWhole}.${kgFrac} kg (${mgToGrams(abs)} g)`;
}

/**
 * Fine gold = gross × purity / basis, rounded to nearest mg.
 * Basis is the configured fineness denominator (995 / 999 / 1000) from
 * Customization → Calculation Rules. Default 999 preserves historical shops.
 * This is the ONLY place this arithmetic should live — call sites must not
 * reimplement ÷999 or ÷1000 inline.
 */
export function fineGoldMg(
  grossMg: number,
  purity: Purity,
  basis: FinenessBasis = DEFAULT_FINENESS_BASIS,
): number {
  if (!Number.isInteger(grossMg) || grossMg < 0)
    throw new Error("grossMg must be non-negative integer");
  if (!Number.isInteger(purity) || purity < 0 || purity > 999)
    throw new Error("purity must be 0..999");
  const b = normalizeFinenessBasis(basis);
  // At/above the configured basis, metal is treated as full fine for this formula.
  // For basis 1000, max stored purity is still 999‰ → treat 999 as full fine.
  if (purity >= b || (b === 1000 && purity >= 999)) return grossMg;
  const product = grossMg * purity;
  return Math.round(product / b);
}

/**
 * Net weight (metal only, after removing stone/gemstone weight) can never
 * exceed gross weight (metal + stones) for the same piece — if it does,
 * gross and net were entered swapped, or net was mistakenly set to a
 * wastage-inclusive billable weight instead of the actual metal weight.
 * Call this wherever a gross/net weight pair is about to be persisted;
 * every other call site should use this rather than re-deriving the check.
 */
export function assertNetNotAboveGross(grossMg: number, netMg: number, context?: string): void {
  if (netMg > grossMg) {
    const suffix = context ? ` — ${context}` : "";
    throw new Error(
      `Net weight (${mgToGrams(netMg)}g) cannot exceed gross weight (${mgToGrams(grossMg)}g)${suffix}`,
    );
  }
}

export function parsePurity(input: string | number): Purity {
  const n = typeof input === "number" ? input : Number(String(input).trim());
  if (!Number.isFinite(n) || n < 0 || n > 999) {
    throw new Error("Purity must be between 0 and 999 (per-mille).");
  }
  return Math.round(n);
}

export function getCaratLabel(purity: number): string {
  const fromMaster = usePurityGradesStore.getState().findByTouch(purity);
  if (fromMaster) return fromMaster.karatLabel;
  if (purity === 999) return "24K (999)";
  if (purity === 995) return "995";
  if (purity === 916) return "22K (916)";
  if (purity === 875) return "21K (875)";
  if (purity === 750) return "18K (750)";
  if (purity === 585) return "14K (585)";
  return `${(purity / 10).toFixed(1)}% (${purity})`;
}

/**
 * @deprecated Call `getDefaultPurityPermille()` from settings-store instead.
 * This constant is kept only for the catalog.masters.tsx display-only usage
 * where a reactive default is not needed. Do NOT use for billing/karigar
 * item initialization — those must read from `getDefaultPurityPermille()`.
 *
 * Historical note: this was incorrectly set to DEFAULT_FINENESS_BASIS (999).
 * It now correctly reflects the MTJ operational default (995). If you need
 * the fineness denominator, use DEFAULT_FINENESS_BASIS explicitly.
 */
export const DEFAULT_PURITY_PERMILLE: Purity = 995;

export { getDefaultPurityPermille } from "@/lib/settings-store";

export const COMMON_PURITIES: { label: string; value: Purity }[] = [
  { label: "999 · Fine", value: 999 },
  { label: "995", value: 995 },
  { label: "920 · 22K touch", value: 920 },
  { label: "916 · 22K", value: 916 },
  { label: "875 · 21K", value: 875 },
  { label: "750 · 18K", value: 750 },
  { label: "585 · 14K", value: 585 },
];

export { getPurityOptions } from "@/lib/purity-grades-store";

export const GOLD_FORMS = [
  { value: "bar", label: "Bar" },
  { value: "scrap", label: "Scrap" },
  { value: "granule", label: "Granule" },
  { value: "old_gold", label: "Old Gold" },
  { value: "other", label: "Other" },
] as const;
export type GoldForm = (typeof GOLD_FORMS)[number]["value"];
