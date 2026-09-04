import { describe, it, expect } from "vitest";
import {
  calculateNetWeight,
  calculateFineFromTouch,
  calculateFineFromPermille1000,
  calculateFineAt999,
  calculateFineAt995,
  calculateHisab,
  calculateFineFromHisab,
  calculateGoldValue,
  calculateMakingPercentage,
  calculateLabourPerGram,
  calculateLabourPerPiece,
  calculateDiscount,
  calculateGst,
  calculateTotalInvoice,
  calculateCashToGoldEquivalent,
  calculateGoldToCashValue,
  calculateMixedSettlement,
  applyCustomerGoldBalance,
  calculateKarigarEarning,
  calculateKarigarLoss,
  calculateKarigarNetSettlement,
  calculatePurityBookBalance,
} from "../../src/lib/mtj-gold-calculation-engine";

describe("MTJ Approved Business Logic Lock — 28 Core Formula Audits", () => {
  // 1. Net Weight: Gross + Add - Less
  it("Formula 1: Net Weight = Gross + Add - Less", () => {
    expect(calculateNetWeight(10.5, 0.2, 0.7)).toBe(10.0);
    expect(calculateNetWeight(25.45, 0.0, 1.25)).toBe(24.2);
  });

  // 2. Touch / Tunch (100 basis)
  it("Formula 2: Touch / Tunch: 10.000g @ 91.6% touch -> 9.160g fine", () => {
    expect(calculateFineFromTouch(10.0, 91.6)).toBe(9.16);
  });

  // 3. Fineness / Per-Mille (1000 basis)
  it("Formula 3: 1000 basis fineness across purities", () => {
    expect(calculateFineFromPermille1000(15.2, 916)).toBe(13.9232);
    expect(calculateFineFromPermille1000(7.1, 750)).toBe(5.325);
    expect(calculateFineFromPermille1000(25.0, 875)).toBe(21.875);
    expect(calculateFineFromPermille1000(5.0, 585)).toBe(2.925);
  });

  // 4. 999 Fineness-Basis Conversion
  it("Formula 4: 999 basis conversion", () => {
    expect(calculateFineAt999(100.0, 999)).toBe(100.0);
    expect(calculateFineAt999(10.0, 916)).toBe(9.169169);
  });

  // 5. 995 Basis
  it("Formula 5: 995 basis conversion", () => {
    expect(calculateFineAt995(100.0, 995)).toBe(100.0);
  });

  // 6 & 7. Wastage -> Hisab & Fine from Hisab
  it("Formula 6 & 7: Wastage -> Hisab: 91.6% touch + 3% wastage -> 94.6% hisab -> 9.460g fine for 10g", () => {
    const hisab = calculateHisab(91.6, 3.0);
    expect(hisab).toBe(94.6);
    expect(calculateFineFromHisab(10.0, hisab)).toBe(9.46);
  });

  // 8. Gold Value (₹)
  it("Formula 8: Gold Value = Fine Gold * Gold Rate", () => {
    expect(calculateGoldValue(9.16, 7500)).toBe(68700.0);
  });

  // 9. Making %
  it("Formula 9: Making % on base amount", () => {
    expect(calculateMakingPercentage(68700, 10)).toBe(6870.0);
  });

  // 10 & 11. Labour per gram & per piece
  it("Formula 10 & 11: Labour rates per gram and per piece", () => {
    expect(calculateLabourPerGram(10.0, 450)).toBe(4500.0);
    expect(calculateLabourPerPiece(5, 250)).toBe(1250.0);
  });

  // 12. Discount
  it("Formula 12: Discount percentage and fixed cap", () => {
    expect(calculateDiscount(10000, 5)).toBe(500.0);
    expect(calculateDiscount(10000, undefined, 750)).toBe(750.0);
  });

  // 13. GST (3% jewelry standard with CGST/SGST split or IGST)
  it("Formula 13: GST calculations", () => {
    const intrastate = calculateGst(10000, 3, false);
    expect(intrastate.totalGst).toBe(300.0);
    expect(intrastate.cgst).toBe(150.0);
    expect(intrastate.sgst).toBe(150.0);
    expect(intrastate.igst).toBe(0.0);

    const interstate = calculateGst(10000, 3, true);
    expect(interstate.totalGst).toBe(300.0);
    expect(interstate.igst).toBe(300.0);
  });

  // 14. Total Invoice Calculation
  it("Formula 14: Total Invoice Value aggregation", () => {
    const invoice = calculateTotalInvoice({
      fineGoldGrams: 10.0,
      goldRatePerGram: 7000,
      makingAmount: 3500,
      labourAmount: 1500,
      discountAmount: 1000,
      gstRatePercent: 3,
      isInterstate: false,
    });
    expect(invoice.goldValue).toBe(70000.0);
    expect(invoice.subtotalTaxable).toBe(75000.0);
    expect(invoice.taxableAfterDiscount).toBe(74000.0);
    expect(invoice.gst.totalGst).toBe(2220.0);
    expect(invoice.totalInvoiceAmount).toBe(76220.0);
  });

  // 15 & 16. Cash <-> Gold Equivalent with transaction rate
  it("Formula 15 & 16: Cash <-> Gold Equivalent", () => {
    const eq = calculateCashToGoldEquivalent(75000, 7500);
    expect(eq.goldEquivalentGrams).toBe(10.0);
    expect(calculateGoldToCashValue(10.0, 7500)).toBe(75000.0);
  });

  // 17. Mixed Settlement (Gold + Cash remainder)
  it("Formula 17: Mixed Settlement remainder cash equivalent", () => {
    const mixed = calculateMixedSettlement(11.05, 11.0, 7500);
    expect(mixed.remainingGoldGrams).toBe(0.05);
    expect(mixed.requiredCashAmount).toBe(375.0);
  });

  // 18 & 19. Existing Customer Gold Balance Application
  it("Formula 18 & 19: Apply customer gold balance without silent cash substitution", () => {
    const result = applyCustomerGoldBalance(15.0, 10.0);
    expect(result.appliedGoldGrams).toBe(10.0);
    expect(result.remainingInvoiceObligationGrams).toBe(0.0);
    expect(result.remainingCustomerBalanceGrams).toBe(5.0);
    expect(result.isFullySettledFromBalance).toBe(true);

    const partial = applyCustomerGoldBalance(6.0, 10.0);
    expect(partial.appliedGoldGrams).toBe(6.0);
    expect(partial.remainingInvoiceObligationGrams).toBe(4.0);
    expect(partial.remainingCustomerBalanceGrams).toBe(0.0);
    expect(partial.isFullySettledFromBalance).toBe(false);
  });

  // 20, 21, 22. Karigar Earning, Loss/Over-Loss, Net Settlement
  it("Formula 20, 21, 22: Karigar earning, allowable loss vs over-loss, net payout", () => {
    expect(calculateKarigarEarning(100.0, 3.5)).toBe(3.5);

    const loss = calculateKarigarLoss(100.0, 97.0, 2.0);
    expect(loss.actualLossGrams).toBe(3.0);
    expect(loss.overLossGrams).toBe(1.0);

    const settlement = calculateKarigarNetSettlement({
      workerEarningGrams: 3.5,
      chainDeductionGrams: 0.5,
      overLossGrams: 1.0,
    });
    expect(settlement.totalDeductionsGrams).toBe(1.5);
    expect(settlement.netSettlementGrams).toBe(2.0);
  });

  // 23. Purity-Wise Book Balance Conservation
  it("Formula 23: Purity book isolated balance conservation", () => {
    const bal = calculatePurityBookBalance({
      purityGrade: "916",
      openingGrams: 50.0,
      receiptsCreditsGrams: 20.0,
      issuesDebitsGrams: 35.0,
      adjustmentsGrams: 0.0,
      settlementsGrams: 0.0,
    });
    expect(bal).toBe(35.0);
  });
});
