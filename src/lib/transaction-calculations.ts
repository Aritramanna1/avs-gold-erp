/**
 * Central transaction calculation orchestrator.
 * All user-facing fine / gold-value / gold+cash settlement math should route here
 * so module rules, purity basis, and snapshots stay consistent.
 */
import {
  computeFineGold,
  effectiveJewelleryCalcFeatures,
  fineGoldMgConfigured,
  type FineGoldInput,
  type FineGoldResult,
  type GoldCalcModuleId,
} from "@/lib/gold-calculation-rules";
import { currentGoldCalculationRules } from "@/lib/gold-calculation-rules-store";
import {
  computeItemTotals,
  computeInvoiceGoldTotals,
  paiseToFineGoldMg,
  type InvoiceItem,
} from "@/lib/billing-store";

export type { FineGoldInput, FineGoldResult };

export function calculateFineGold(
  input: FineGoldInput,
  config = currentGoldCalculationRules(),
): FineGoldResult {
  return computeFineGold(input, config);
}

/** Module-aware fine with BASIC-mode purity preview when deep fine calc is off. */
export function calculateModuleFineMg(
  module: GoldCalcModuleId,
  input: Omit<FineGoldInput, "module">,
  config = currentGoldCalculationRules(),
): FineGoldResult {
  const result = calculateFineGold({ module, ...input }, config);
  const features = effectiveJewelleryCalcFeatures(config);
  if (
    !features.fineCalculation &&
    result.fineMg === 0 &&
    input.purityPermille &&
    input.grossMg
  ) {
    const previewFine = fineGoldMgConfigured(input.grossMg, input.purityPermille, config);
    return {
      ...result,
      fineMg: previewFine,
      snapshot: {
        ...result.snapshot,
        fineMg: previewFine,
        formulaLabel: `${result.snapshot.formulaLabel} · purity preview`,
      },
    };
  }
  return result;
}

export function calculateSettlementLineFine(input: {
  grossMg: number;
  purityPermille: number;
}): FineGoldResult {
  return calculateModuleFineMg("gold_settlement", {
    grossMg: input.grossMg,
    purityPermille: input.purityPermille,
    tanchPct: input.purityPermille / 10,
  });
}

/** Fine milligrams → rupee value at transaction-time rate (integer paise). */
export function calculateGoldValuePaise(fineMg: number, ratePerGramPaise: number): number {
  if (!Number.isFinite(fineMg) || fineMg <= 0) return 0;
  if (!Number.isFinite(ratePerGramPaise) || ratePerGramPaise <= 0) return 0;
  return Math.round((fineMg * ratePerGramPaise) / 1000);
}

/** Gold-first payment: remaining fine obligation and cash equivalent at live/transaction rate. */
export function calculateGoldCashSettlement(input: {
  obligationFineMg: number;
  goldPaidFineMg: number;
  ratePerGramPaise: number;
}): {
  remainingFineMg: number;
  cashEquivalentPaise: number;
} {
  const obligationFineMg = Math.max(0, Math.round(input.obligationFineMg));
  const goldPaidFineMg = Math.max(0, Math.round(input.goldPaidFineMg));
  const remainingFineMg = Math.max(0, obligationFineMg - goldPaidFineMg);
  return {
    remainingFineMg,
    cashEquivalentPaise: calculateGoldValuePaise(remainingFineMg, input.ratePerGramPaise),
  };
}

export {
  computeItemTotals,
  computeInvoiceGoldTotals,
  paiseToFineGoldMg,
  type InvoiceItem,
};
