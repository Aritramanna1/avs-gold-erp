/**
 * Ma Tara / firm workshop policy (app_settings firm blob).
 *
 * Configuration-only in this wave (foundation CVsE73i6):
 * - pureGoldReferencePermille default = 995 for MTJ default bundle / settings
 * - Does NOT rewrite production fineGoldMg (/999) formula
 *
 * Material payable map: missing key ⇒ PAYABLE. Do not invent non-payable lists.
 */
export interface MaTaraWorkshopPolicy {
  /** Firm default pure-gold reference (config). Does not change live fineGoldMg math. */
  pureGoldReferencePermille: number;
  materialPayableByCategoryKey?: Record<string, boolean>;
}

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
