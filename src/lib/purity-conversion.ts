/**
 * Subtle purity conversion helper math — milligrams only.
 * Fine path uses Customization module `conversion` via computeFineGold;
 * inverse gross uses live finenessBasis (995 / 999 / 1000).
 */
import { grossFromFineMg, mgToGrams, type Purity } from "./gold";
import { computeFineGold } from "./gold-calculation-rules";
import { currentGoldCalculationRules } from "./gold-calculation-rules-store";

export interface PurityConversionResult {
  fineMg: number;
  equivalentGrossMg: number;
  alloyMg: number;
  expectedOutputMg: number;
}

/** fine via conversion module rule; equivalent at target = fine × basis / to; alloy = max(0, eq − gross). */
export function calculatePurityConversion(input: {
  weightMg: number;
  fromPurityPermille: Purity;
  toPurityPermille: Purity;
  expectedLossPct?: number;
}): PurityConversionResult {
  const { weightMg, fromPurityPermille, toPurityPermille } = input;
  if (!Number.isSafeInteger(weightMg) || weightMg < 0) {
    throw new Error("Weight must be a non-negative integer in milligrams.");
  }
  const rules = currentGoldCalculationRules();
  const fineMg = computeFineGold(
    {
      module: "conversion",
      grossMg: weightMg,
      purityPermille: Math.min(fromPurityPermille, 999),
    },
    rules,
  ).fineMg;
  const to = Math.min(Math.max(toPurityPermille, 1), 999);
  const equivalentGrossMg = grossFromFineMg(fineMg, to as Purity, rules.finenessBasis);
  const alloyMg = Math.max(0, equivalentGrossMg - weightMg);
  const lossPct = Math.max(0, input.expectedLossPct ?? 0);
  const expectedOutputMg = Math.max(
    0,
    equivalentGrossMg - Math.round((equivalentGrossMg * lossPct) / 100),
  );
  return { fineMg, equivalentGrossMg, alloyMg, expectedOutputMg };
}

export function formatPurityConversionGrams(r: PurityConversionResult) {
  return {
    fineG: mgToGrams(r.fineMg),
    equivalentG: mgToGrams(r.equivalentGrossMg),
    alloyG: mgToGrams(r.alloyMg),
    expectedOutputG: mgToGrams(r.expectedOutputMg),
  };
}
