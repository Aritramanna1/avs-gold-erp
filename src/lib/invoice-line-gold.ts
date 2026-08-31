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
  const lessMg = Math.max(0, Math.round(it.lessMg ?? Math.max(0, it.grossMg - it.netMg)));
  // Prefer dedicated Offline Add_wt; fall back to legacy stoneWeightMg-as-Add.
  const addMg = Math.max(0, Math.round(it.addMg ?? it.stoneWeightMg ?? 0));
  const fineEnabled = isJewelleryCalcFeatureEnabled("fineCalculation", rules);
  const wastageEnabled = isJewelleryCalcFeatureEnabled("wastageCalculation", rules);
  const makingEnabled = isJewelleryCalcFeatureEnabled("makingCalculation", rules);
  const tanchPct = it.purity / 10;
  const wastagePct = wastageEnabled ? (it.wastagePct ?? 0) : 0;

  const useHisobPath =
    billingType === "manufacturing" ||
    billingType === "wholesale" ||
    billingType === "ready_stock" ||
    billingType === "custom_order" ||
    !billingType;

  if (useHisobPath) {
    const module =
      billingType === "manufacturing" || billingType === "wholesale"
        ? "mfg_billing"
        : "retail_billing";

    const result = computeFineGold(
      {
        module,
        grossMg: Math.max(0, Math.round(it.grossMg)),
        lessMg,
        addMg,
        tanchPct,
        wastagePct: wastageEnabled ? wastagePct : 0,
        userFineMg: it.fineMg,
        method:
          wastageEnabled || billingType === "manufacturing" || billingType === "wholesale"
            ? "hisob_100"
            : undefined,
      },
      rules,
    );

    if (!fineEnabled) {
      const next: InvoiceItem = {
        ...it,
        lessMg,
        addMg,
        netMg: result.netMg,
        fineMg: Math.max(0, Math.round(it.fineMg ?? 0)),
        hisobPct: it.hisobPct,
        wastagePct: it.wastagePct,
        formulaSnapshot: result.snapshot,
      };
      const totaled = { ...next, ...computeItemTotals(next) };
      if (!makingEnabled) {
        return { ...totaled, makingChargesPaise: it.makingChargesPaise };
      }
      return totaled;
    }

    const expectedHisob =
      result.hisobPct ?? Math.round((tanchPct + (wastageEnabled ? wastagePct : 0)) * 100) / 100;
    const manualHisob = it.hisobPct;
    const useManualHisob =
      manualHisob != null &&
      Number.isFinite(manualHisob) &&
      Math.abs(manualHisob - expectedHisob) > 0.009;

    if (useManualHisob) {
      const fineMg = Math.round((result.netMg * (manualHisob as number)) / 100);
      const next: InvoiceItem = {
        ...it,
        lessMg,
        addMg,
        netMg: result.netMg,
        fineMg,
        hisobPct: Math.round((manualHisob as number) * 100) / 100,
        wastagePct: it.wastagePct,
        formulaSnapshot: {
          ...result.snapshot,
          fineMg,
          hisobPct: Math.round((manualHisob as number) * 100) / 100,
          formulaLabel: "Net × Hisob ÷ 100 → Fine (manual Hisob)",
          userControlledFine: true,
        },
      };
      return { ...next, ...computeItemTotals(next) };
    }

    const next: InvoiceItem = {
      ...it,
      lessMg,
      addMg,
      netMg: result.netMg,
      fineMg: result.fineMg,
      hisobPct: result.hisobPct,
      wastagePct: it.wastagePct,
      formulaSnapshot: result.snapshot,
    };
    return { ...next, ...computeItemTotals(next) };
  }

  // Repair / polishing / receipts — lighter Offline-compatible net arithmetic
  const result = computeFineGold(
    {
      module: "retail_billing",
      grossMg: Math.max(0, Math.round(it.grossMg || it.netMg)),
      lessMg,
      addMg,
      purityPermille: Math.max(0, Math.min(999, Math.round(it.purity))),
      wastagePct: wastageEnabled ? wastagePct : 0,
      userFineMg: it.fineMg,
    },
    rules,
  );

  if (!fineEnabled) {
    const next: InvoiceItem = {
      ...it,
      lessMg,
      addMg,
      netMg: result.netMg,
      fineMg: Math.max(0, Math.round(it.fineMg ?? 0)),
      formulaSnapshot: result.snapshot,
    };
    return { ...next, ...computeItemTotals(next) };
  }

  const next: InvoiceItem = {
    ...it,
    lessMg,
    addMg,
    netMg: result.netMg,
    fineMg: result.fineMg,
    hisobPct: result.hisobPct ?? it.hisobPct,
    formulaSnapshot: result.snapshot,
  };
  return { ...next, ...computeItemTotals(next) };
}

export type { FormulaSnapshot };
