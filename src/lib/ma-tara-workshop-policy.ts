/**
 * Ma Tara / firm workshop policy (app_settings firm blob).
 *
 * Owner-locked (2026-08-27):
 * - pureGoldReferencePermille default = 995
 *
 * Other Ma Tara policy fields (payout, payable materials, GST default, edition
 * identity) remain unconfigured until separately approved — do not invent values.
 *
 * Historical posted fine/money must not be silently recalculated when this
 * setting changes; new calculations read the current policy via gold.ts.
 */
export interface MaTaraWorkshopPolicy {
  /**
   * Pure-gold reference per-mille used as the denominator for fine-gold math:
   * fineMg = round(grossMg × purity / pureGoldReferencePermille).
   * OWNER LOCKED DEFAULT: 995.
   */
  pureGoldReferencePermille: number;
  /**
   * Optional per-category payable map for existing material vault keys.
   * Missing key or empty map ⇒ PAYABLE (preserves existing behaviour).
   * `false` ⇒ NON-PAYABLE (excluded from payout / wastage-eligible metal).
   * Do not invent defaults for specific materials without owner approval.
   */
  materialPayableByCategoryKey?: Record<string, boolean>;
}

/** Owner-locked default pure-gold reference (per-mille). */
export const DEFAULT_PURE_GOLD_REFERENCE_PERMILLE = 995;

export const DEFAULT_MA_TARA_WORKSHOP_POLICY: MaTaraWorkshopPolicy = {
  pureGoldReferencePermille: DEFAULT_PURE_GOLD_REFERENCE_PERMILLE,
  materialPayableByCategoryKey: {},
};

export function normalizeMaTaraWorkshopPolicy(
  raw: Partial<MaTaraWorkshopPolicy> | null | undefined,
): MaTaraWorkshopPolicy {
  const n = Number(raw?.pureGoldReferencePermille);
  const pureGoldReferencePermille =
    Number.isInteger(n) && n >= 900 && n <= 999 ? n : DEFAULT_PURE_GOLD_REFERENCE_PERMILLE;
  const flags = raw?.materialPayableByCategoryKey;
  const materialPayableByCategoryKey: Record<string, boolean> = {};
  if (flags && typeof flags === "object" && !Array.isArray(flags)) {
    for (const [k, v] of Object.entries(flags)) {
      if (typeof k === "string" && k.length > 0 && typeof v === "boolean") {
        materialPayableByCategoryKey[k] = v;
      }
    }
  }
  return { pureGoldReferencePermille, materialPayableByCategoryKey };
}

/** Default true — existing AVS behaviour until an admin sets false. */
export function isMaterialCategoryPayable(
  categoryKey: string,
  policy: Pick<MaTaraWorkshopPolicy, "materialPayableByCategoryKey"> | null | undefined,
): boolean {
  const flags = policy?.materialPayableByCategoryKey;
  if (!flags || !(categoryKey in flags)) return true;
  return flags[categoryKey] !== false;
}
