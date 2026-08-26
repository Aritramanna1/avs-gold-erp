/**
 * MTJ ERP — Gold core utilities
 *
 * Internal storage rule:
 *   - weights are stored as **integer milligrams (mg)**
 *   - purity is stored as **per-mille integer** (e.g. 916 for 22K, 999 for fine, 750 for 18K)
 *   - money (when added later) is stored as **integer paise**
 *
 * Never store weights or money as floating point. Convert only at I/O boundaries
 * (display + parsing). All accounting math runs on integers.
 *
 * Pure-gold reference (owner-locked default 995) is read from firm policy via
 * {@link getPureGoldReferencePermille}. Do not reimplement fine math elsewhere.
 * Posted historical fineMg values must not be silently rewritten when the
 * reference changes — pass an explicit override only for audited replay.
 */

import { usePurityGradesStore } from "@/lib/purity-grades-store";
import { DEFAULT_PURE_GOLD_REFERENCE_PERMILLE } from "@/lib/ma-tara-workshop-policy";

export type Purity = number; // per-mille, 0..999

export type FineGoldOptions = {
  /** Explicit reference for audited replay; omit to use firm policy / default. */
  pureGoldReferencePermille?: number;
};

let pureGoldReferenceResolver: () => number = () => DEFAULT_PURE_GOLD_REFERENCE_PERMILLE;

/** Wire firm settings so fineGoldMg reads one configuration source. */
export function setPureGoldReferenceResolver(fn: () => number): void {
  pureGoldReferenceResolver = fn;
}

/** Current pure-gold reference per-mille (default 995). */
export function getPureGoldReferencePermille(): number {
  const n = Number(pureGoldReferenceResolver());
  if (!Number.isInteger(n) || n < 900 || n > 999) {
    return DEFAULT_PURE_GOLD_REFERENCE_PERMILLE;
  }
  return n;
}

function resolvePureGoldReference(options?: FineGoldOptions): number {
  const explicit = options?.pureGoldReferencePermille;
  if (explicit !== undefined) {
    if (!Number.isInteger(explicit) || explicit < 900 || explicit > 999) {
      throw new Error("pureGoldReferencePermille must be integer 900..999");
    }
    return explicit;
  }
  return getPureGoldReferencePermille();
}

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

/** Convert mg → grams string with exactly 3 decimal places. */
export function mgToGrams(mg: number, opts: { sign?: boolean } = {}): string {
  const neg = mg < 0;
  const abs = Math.abs(mg);
  const whole = Math.floor(abs / 1000);
  const frac = (abs % 1000).toString().padStart(3, "0");
  const body = `${whole}.${frac}`;
  if (opts.sign && !neg && mg > 0) return `+${body}`;
  return neg ? `-${body}` : body;
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
 * Fine gold = round(gross × purity / pureGoldReferencePermille).
 *
 * Owner-locked default reference = 995 (firm policy `maTaraWorkshopPolicy`).
 * At-or-above the configured pure reference counts as full fine (= gross).
 * This is the ONLY place this formula should be implemented; every other
 * call site must import fineGoldMg() rather than reimplementing arithmetic.
 *
 * Do not use this to rewrite posted historical fineMg — stored results remain
 * authoritative. Pass `options.pureGoldReferencePermille` only for audited replay.
 */
export function fineGoldMg(grossMg: number, purity: Purity, options?: FineGoldOptions): number {
  if (!Number.isInteger(grossMg) || grossMg < 0)
    throw new Error("grossMg must be non-negative integer");
  if (!Number.isInteger(purity) || purity < 0 || purity > 999)
    throw new Error("purity must be 0..999");
  const pureRef = resolvePureGoldReference(options);
  if (purity >= pureRef) return grossMg;
  const product = grossMg * purity;
  return Math.round(product / pureRef);
}

/**
 * Inverse of {@link fineGoldMg}: approximate gross from fine at a purity,
 * using the same pure-gold reference (default 995).
 */
export function grossFromFineMg(fineMg: number, purity: Purity, options?: FineGoldOptions): number {
  if (!Number.isInteger(fineMg) || fineMg < 0)
    throw new Error("fineMg must be non-negative integer");
  if (!Number.isInteger(purity) || purity <= 0 || purity > 999)
    throw new Error("purity must be 1..999");
  const pureRef = resolvePureGoldReference(options);
  if (purity >= pureRef) return fineMg;
  return Math.round((fineMg * pureRef) / purity);
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

export const COMMON_PURITIES: { label: string; value: Purity }[] = [
  { label: "995 · Pure (default reference)", value: 995 },
  { label: "999 · Fine", value: 999 },
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
