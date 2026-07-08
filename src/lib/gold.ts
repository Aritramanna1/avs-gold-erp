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
 */

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

/**
 * Fine gold = gross × purity / 999, rounded to nearest mg — this shop's
 * convention expresses purity as a fraction of practical-maximum (999 touch),
 * not literal parts-per-1000. This is the ONLY place this formula should be
 * implemented; every other call site must import fineGoldMg() rather than
 * reimplementing the arithmetic, or it will silently disagree with the
 * ledger by using /1000 instead.
 */
export function fineGoldMg(grossMg: number, purity: Purity): number {
  if (!Number.isInteger(grossMg) || grossMg < 0)
    throw new Error("grossMg must be non-negative integer");
  if (!Number.isInteger(purity) || purity < 0 || purity > 999)
    throw new Error("purity must be 0..999");
  if (purity >= 999) return grossMg;
  const product = grossMg * purity;
  return Math.round(product / 999);
}

export function parsePurity(input: string | number): Purity {
  const n = typeof input === "number" ? input : Number(String(input).trim());
  if (!Number.isFinite(n) || n < 0 || n > 999) {
    throw new Error("Purity must be between 0 and 999 (per-mille).");
  }
  return Math.round(n);
}

export function getCaratLabel(purity: number): string {
  if (purity === 999) return "24K (999)";
  if (purity === 995) return "995";
  if (purity === 916) return "22K (916)";
  if (purity === 875) return "21K (875)";
  if (purity === 750) return "18K (750)";
  if (purity === 585) return "14K (585)";
  return `${(purity / 10).toFixed(1)}% (${purity})`;
}

export const COMMON_PURITIES: { label: string; value: Purity }[] = [
  { label: "999 · Fine", value: 999 },
  { label: "995", value: 995 },
  { label: "916 · 22K", value: 916 },
  { label: "875 · 21K", value: 875 },
  { label: "750 · 18K", value: 750 },
  { label: "585 · 14K", value: 585 },
];

export const GOLD_FORMS = [
  { value: "bar", label: "Bar" },
  { value: "scrap", label: "Scrap" },
  { value: "granule", label: "Granule" },
  { value: "old_gold", label: "Old Gold" },
  { value: "other", label: "Other" },
] as const;
export type GoldForm = (typeof GOLD_FORMS)[number]["value"];
