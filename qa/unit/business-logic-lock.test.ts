/**
 * AVS / MTJ ERP — Business Logic Lock Comprehensive Unit Test Suite
 *
 * Verifies all rules from the authoritative Business Logic Lock document:
 * 1. Gold-First Source of Truth (Fine gold is primary, cash is secondary).
 * 2. Net Weight = Gross + Add - Less.
 * 3. Hisab & Fine Gold Formulas:
 *    - Hisab = Tunch + Wastage (e.g. 92 + 4w = 96%, 92 + 3w = 95%).
 *    - Fine Gold = Net × Hisab / 100 (e.g. 100 × 96% = 96.000g, 100 × 88% = 88.000g).
 * 4. Manufacturing / Karigar Melting Conversion (24K Gold in alloyed melting):
 *    - 100 ÷ 91.6 = 109.170g (24k used in 91.6% manufacturing).
 *    - 100 ÷ 83.5 = 119.760g (24k used in 83.5% manufacturing).
 * 5. Payment & Settlement (Cash to Gold Bhav Conversion):
 *    - ₹1,00,000 ÷ ₹15,000/g = 6.666g gold equivalent.
 *    - Mixed remainder settlement: 11.050g obligation, 11.000g gold paid, 0.050g remainder at ₹7,500/g = ₹375 cash.
 * 6. Karigar Custody & Chain Deduction:
 *    - 50.000g Gold + 10.000g Zinc − 10.000g Chain deducted = 40.000g remaining (Total 70.000g tracked).
 *    - Earning: 100g @ 2.50% = 2.500g.
 * 7. Default Calculation Mode is Advanced with all jewellery features active.
 */

import { describe, it, expect } from "vitest";
import {
  calculateNetWeight,
  calculateHisab,
  calculateFineFromHisab,
  calculateManufacturingMeltingWeight,
  calculateBillingFineGold,
  calculateBhavGoldEquivalent,
  calculateMixedSettlement,
  calculateKarigarEarning,
  calculateKarigarNetSettlement,
} from "@/lib/mtj-gold-calculation-engine";
import {
  defaultGoldCalculationRules,
  effectiveJewelleryCalcFeatures,
} from "@/lib/gold-calculation-rules";

describe("MTJ / AVS ERP — Business Logic Lock Compliance", () => {
  it("1. Default Calculation Mode is Advanced with all features enabled", () => {
    const rules = defaultGoldCalculationRules();
    expect(rules.calculationMode).toBe("advanced");
    
    const features = effectiveJewelleryCalcFeatures(rules);
    expect(features.purityCalculation).toBe(true);
    expect(features.wastageCalculation).toBe(true);
    expect(features.fineCalculation).toBe(true);
    expect(features.alloyCalculation).toBe(true);
    expect(features.automaticLoss).toBe(true);
    expect(features.makingCalculation).toBe(true);
    expect(features.settlementCalculation).toBe(true);
  });

  it("2. Invariant Net Weight: Net = Gross + Add - Less", () => {
    // Example: Gross 15.500g, Add 0.500g, Less 1.000g -> Net 15.000g
    expect(calculateNetWeight(15.5, 0.5, 1.0)).toBe(15.0);
    // Gross 10.000g, Add 0, Less 0.200g -> Net 9.800g
    expect(calculateNetWeight(10.0, 0, 0.2)).toBe(9.8);
  });

  it("3. Hisab and Billing Fine Gold Calculations", () => {
    // 92 + 4w = 96%
    const hisab1 = calculateHisab(92, 4);
    expect(hisab1).toBe(96);
    expect(calculateFineFromHisab(100, hisab1)).toBe(96.0);

    // 92 + 3w = 95%
    const hisab2 = calculateHisab(92, 3);
    expect(hisab2).toBe(95);

    // 100 x 88% = 88.000 fine
    expect(calculateBillingFineGold(100, 88)).toBe(88.0);

    // 10g x (91.6 + 3) / 100 = 9.460g
    const hisab3 = calculateHisab(91.6, 3);
    expect(hisab3).toBe(94.6);
    expect(calculateFineFromHisab(10, hisab3)).toBe(9.46);
  });

  it("4. Manufacturing / Karigar Melting Conversion (24K Gold in Melting)", () => {
    // Rule: 100 ÷ 91.6 = 109.170 g (for use of 24k in manufacturing)
    const result916 = calculateManufacturingMeltingWeight(100, 91.6);
    expect(result916).toBe(109.17);

    // Rule: 100 ÷ 83.5 = 119.760 g
    const result835 = calculateManufacturingMeltingWeight(100, 83.5);
    expect(result835).toBe(119.76);
  });

  it("5. Payment & Settlement (Bhav / Gold Rate Conversion)", () => {
    // Rule: ₹1,00,000 cash at ₹15,000/g Bhav = 6.666 g Gold Equivalent
    const goldEquiv = calculateBhavGoldEquivalent(100000, 15000);
    expect(goldEquiv).toBe(6.666);

    // Remainder settlement: 11.050g obligation, 11.000g gold received, remainder 0.050g @ ₹7,500/g = ₹375
    const settlement = calculateMixedSettlement(11.05, 11.0, 7500);
    expect(settlement.remainingGoldGrams).toBe(0.05);
    expect(settlement.requiredCashAmount).toBe(375.0);
  });

  it("6. Karigar Custody, Wage Earning and Chain Deduction", () => {
    // Worker earning: 100g at 2.50% = 2.500g earning
    const earning = calculateKarigarEarning(100, 2.5);
    expect(earning).toBe(2.5);

    // Settlement with chain deduction: 50.0g earning, 10.0g chain deduction -> 40.0g net settlement
    const settlement = calculateKarigarNetSettlement({
      workerEarningGrams: 50.0,
      chainDeductionGrams: 10.0,
      overLossGrams: 0,
      otherDeductionsGrams: 0,
    });
    expect(settlement.totalDeductionsGrams).toBe(10.0);
    expect(settlement.netSettlementGrams).toBe(40.0);
  });
});
