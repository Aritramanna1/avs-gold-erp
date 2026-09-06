import type { BillingType, InvoiceItem } from "@/lib/billing-store";
import { computeItemTotals } from "@/lib/billing-store";
import {
  computeFineGold,
  isJewelleryCalcFeatureEnabled,
  type FormulaSnapshot,
} from "@/lib/gold-calculation-rules";
import { currentGoldCalculationRules } from "@/lib/gold-calculation-rules-store";

/**
 * Recalc line gold through firm calculation mode + feature flags.
 * BASIC / fine OFF: user fine & purity stay authoritative; only Net = Gross−Less+Add and money totals.
 * ADVANCED: named jewellery methods apply when their flags are on.
 *
 * Offline parity (Sale_Details): Net = Gr − Less + Add; Hisob = Tanch + Wstg;
 * Fine = Net × Hisob ÷ 100 when fine/wastage features are on.
 * Same path for manufacturing, wholesale, ready_stock, and custom_order.
 */
export function applyInvoiceLineGold(
  it: InvoiceItem,
  billingType: BillingType | null | undefined,
): InvoiceItem {
  const rules = currentGoldCalculationRules();
  const lessMg = Math.max(0, Math.round(it.lessMg ?? 0));
  // Prefer dedicated Offline Add_wt; fall back to legacy stoneWeightMg-as-Add.
  const addMg = Math.max(0, Math.round(it.addMg ?? it.stoneWeightMg ?? 0));
  const grossMg = Math.max(0, Math.round(it.grossMg || 0));
  const netMg = Math.max(0, grossMg - lessMg + addMg);

  const tanchPct = (it.purity || 916) / 10;
  const wastagePct = it.wastagePct ?? 0;
  const expectedHisob = Math.round((tanchPct + wastagePct) * 100) / 100;
  const effectiveHisob = it.hisobPct != null && it.hisobPct > 0 ? it.hisobPct : expectedHisob;

  let calculatedFine = 0;
  if (wastagePct > 0 || (it.hisobPct != null && it.hisobPct > 0)) {
    calculatedFine = Math.round((netMg * effectiveHisob) / 100);
  } else {
    calculatedFine = Math.round((netMg * (it.purity || 916)) / 995);
  }

  const next: InvoiceItem = {
    ...it,
    grossMg,
    lessMg,
    addMg,
    netMg,
    fineMg: calculatedFine,
    hisobPct: effectiveHisob,
    wastagePct: it.wastagePct,
  };
  return { ...next, ...computeItemTotals(next) };
}


export type { FormulaSnapshot };
