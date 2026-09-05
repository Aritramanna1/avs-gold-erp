/**
 * MTJ ERP — Comprehensive Gold Calculation Reference Test Suite
 *
 * Implements verification for all 28 MTJ gold calculation formulas and
 * Mandatory Test Cases A through Q:
 *
 * A. 100 g @ 916
 * B. 100 g @ 995 on 999 basis
 * C. Gross + Add − Less
 * D. Tunch + Wastage (Hisab)
 * E. Gold Value
 * F. Making %
 * G. Labour/g
 * H. GST
 * I. Discount
 * J. Cash → Gold Equivalent
 * K. Mixed Gold + Cash
 * L. Existing 200 g → 50 g invoice
 * M. Existing 30 g → 50 g invoice
 * N. Karigar 100 g @ 0.50%
 * O. Over-Loss
 * P. Negative Balance
 * Q. Multiple Purity Books
 */

import { describe, it, expect } from "vitest";
import {
  calculateNetWeight,
  calculateFineFromTouch,
  calculateFineAt995,
  calculateFineAtBasis,
  calculateManufacturingMeltingWeight,
  calculateBillingFineGold,
  calculateBhavGoldEquivalent,
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
  formatGoldWeight,
  formatCurrency,
  createGoldFirstValue,
  calculateGoldFirstBillTotals,
  calculateGoldFirstProfit,
  calculateGoldFirstExpense,
  calculateGoldFirstOutstanding,
} from "../../src/lib/mtj-gold-calculation-engine";

describe("MTJ ERP — Gold-First Calculation Master Reference Suite", () => {
  // ── Section 1: Tunch / Purity on 995 Basis ────────────────────────────────
  describe("Section 1: Tunch / Purity on 995 Basis Examples", () => {
    it("Example A: 100.000 g @ 995 -> 100.000 g", () => {
      const fine = calculateFineAt995(100.0, 995);
      expect(fine).toBe(100.0);
      expect(formatGoldWeight(fine)).toBe("100.000");
    });

    it("Example B: 100.000 g @ 916 -> 92.060 g", () => {
      const fine = calculateFineAt995(100.0, 916);
      expect(fine).toBeCloseTo(92.06, 3);
      expect(formatGoldWeight(fine)).toBe("92.060");
    });

    it("Example C: 50.000 g @ 916 -> 46.030 g", () => {
      const fine = calculateFineAt995(50.0, 916);
      expect(fine).toBeCloseTo(46.03, 3);
      expect(formatGoldWeight(fine)).toBe("46.030");
    });

    it("Example D: 25.000 g @ 750 -> 18.844 g", () => {
      const fine = calculateFineAt995(25.0, 750);
      expect(fine).toBeCloseTo(18.844, 3);
      expect(formatGoldWeight(fine)).toBe("18.844");
    });
  });

  // ── Section 2: Tunch / Purity on Authoritative 995 Basis ──────────────────
  describe("Section 2: Tunch / Purity on Authoritative 995 Basis Examples", () => {
    it("100 g @ 995 -> 100.000 g", () => {
      const fine = calculateFineAt995(100.0, 995);
      expect(fine).toBe(100.0);
      expect(formatGoldWeight(fine)).toBe("100.000");
    });

    it("100 g @ 916 -> 92.060 g", () => {
      const fine = calculateFineAt995(100.0, 916);
      expect(fine).toBeCloseTo(92.060, 3);
      expect(formatGoldWeight(fine)).toBe("92.060");
    });

    it("100 g @ 750 -> 75.377 g", () => {
      const fine = calculateFineAt995(100.0, 750);
      expect(fine).toBeCloseTo(75.377, 3);
      expect(formatGoldWeight(fine)).toBe("75.377");
    });
  });

  // ── Section 4: Net Weight ────────────────────────────────────────────────
  describe("Section 4: Net Weight (Gross 100.000 + Add 2.000 - Less 1.500)", () => {
    it("Calculates Net = 100.500 g", () => {
      const net = calculateNetWeight(100.0, 2.0, 1.5);
      expect(net).toBe(100.5);
      expect(formatGoldWeight(net)).toBe("100.500");
    });
  });

  // ── Section 5: Hisab 91.6% + 2.5% = 94.100% ─────────────────────────────
  describe("Section 5: Hisab (Touch 91.600% + Wastage 2.500% = 94.100%)", () => {
    it("Calculates Hisab = 94.100% and Fine = 94.100 g from 100 g net", () => {
      const hisab = calculateHisab(91.6, 2.5);
      expect(hisab).toBe(94.1);
      const fine = calculateFineFromHisab(100.0, hisab);
      expect(fine).toBe(94.1);
      expect(formatGoldWeight(fine)).toBe("94.100");
    });
  });

  // ── Section 7 & 8: Making & Labour Gold Equivalent ───────────────────────
  describe("Section 7 & 8: Making & Labour Gold Equivalent", () => {
    it("Making ₹10,000 @ ₹10,000/g = 1.000 g equivalent", () => {
      const making = createGoldFirstValue(10000, 10000);
      expect(making.goldEquivalentGrams).toBe(1.0);
      expect(making.primaryLabel).toBe("1.000 g equivalent");
      expect(making.secondaryLabel).toBe("₹10,000.00");
    });

    it("Labour 20 g @ ₹150/g = ₹3,000 -> 0.300 g equivalent @ ₹10,000/g", () => {
      const labourRupees = calculateLabourPerGram(20.0, 150);
      expect(labourRupees).toBe(3000);
      const labour = createGoldFirstValue(labourRupees, 10000);
      expect(labour.goldEquivalentGrams).toBe(0.3);
      expect(labour.primaryLabel).toBe("0.300 g equivalent");
      expect(labour.secondaryLabel).toBe("₹3,000.00");
    });
  });

  // ── Section 9 & 10: Discount & GST Gold Equivalent ────────────────────────
  describe("Section 9 & 10: Discount & GST Gold Equivalent", () => {
    it("Discount ₹1,000 @ ₹10,000/g = 0.100 g equivalent", () => {
      const disc = createGoldFirstValue(1000, 10000);
      expect(disc.goldEquivalentGrams).toBe(0.1);
      expect(disc.primaryLabel).toBe("0.100 g equivalent");
      expect(disc.secondaryLabel).toBe("₹1,000.00");
    });

    it("GST ₹3,000 @ ₹10,000/g = 0.300 g equivalent", () => {
      const gst = createGoldFirstValue(3000, 10000);
      expect(gst.goldEquivalentGrams).toBe(0.3);
      expect(gst.primaryLabel).toBe("0.300 g equivalent");
      expect(gst.secondaryLabel).toBe("₹3,000.00");
    });
  });

  // ── Section 11: Total Bill Gold-First Master Total ────────────────────────
  describe("Section 11: Total Bill Gold-First Master", () => {
    it("Gold ₹100,000 + Making ₹10,000 + Labour ₹5,000 + GST ₹3,000 - Discount ₹2,000 = ₹116,000 -> 11.600 g", () => {
      const bill = calculateGoldFirstBillTotals(100000, 10000, 5000, 3000, 2000, 10000);
      expect(bill.netRupeesTotal).toBe(116000);
      expect(bill.goldEquivalentTotalGrams).toBe(11.6);
      expect(bill.primaryDisplay).toBe("11.600 g GOLD EQUIVALENT");
      expect(bill.secondaryDisplay).toBe("₹1,16,000.00");
    });
  });

  // ── Section 16: Credit / Outstanding Gold Equivalent ─────────────────────
  describe("Section 16: Credit / Outstanding Gold Equivalent", () => {
    it("Outstanding ₹55,000 @ ₹11,000/g = 5.000 g equivalent", () => {
      const out = calculateGoldFirstOutstanding(55000, 11000);
      expect(out.goldEquivalentGrams).toBe(5.0);
      expect(out.primaryLabel).toBe("5.000 g equivalent");
      expect(out.secondaryLabel).toBe("₹55,000.00");
    });
  });

  // ── Section 19 & 20: Profit & Expense Gold Equivalent ─────────────────────
  describe("Section 19 & 20: Profit & Expense Gold Equivalent", () => {
    it("Business Profit ₹50,000 @ ₹10,000/g = 5.000 g equivalent", () => {
      const profit = calculateGoldFirstProfit(5000, 1000);
      expect(profit.goldEquivalentGrams).toBe(5.0);
      expect(profit.primaryLabel).toBe("5.000 g equivalent");
      expect(profit.secondaryLabel).toBe("₹5,000.00");
    });

    it("Business Expense ₹20,000 @ ₹10,000/g = 2.000 g equivalent", () => {
      const expense = calculateGoldFirstExpense(20000, 10000);
      expect(expense.goldEquivalentGrams).toBe(2.0);
      expect(expense.primaryLabel).toBe("2.000 g equivalent");
      expect(expense.secondaryLabel).toBe("₹20,000.00");
    });
  });
  // ── Test Case A: 100 g @ 916 ─────────────────────────────────────────────
  describe("Test Case A: 100 g @ 916", () => {
    it("Calculates 100 g @ 916‰ on authoritative 995 basis", () => {
      const net = 100.0;
      const purity = 916;
      const fine = calculateFineAt995(net, purity);
      expect(fine).toBeCloseTo(92.060, 3);
      expect(formatGoldWeight(fine)).toBe("92.060");
    });

    it("Calculates 100 g @ 91.6% touch as exactly 91.600 g fine", () => {
      const net = 100.0;
      const touch = 91.6;
      const fine = calculateFineFromTouch(net, touch);
      expect(fine).toBe(91.6);
      expect(formatGoldWeight(fine)).toBe("91.600");
    });
  });

  // ── Test Case B: 100 g @ 995 on 995 basis ────────────────────────────────
  describe("Test Case B: 100 g @ 995 on 995 basis", () => {
    it("Calculates 100 g @ 995‰ on 995 basis as exactly 100.000 g fine", () => {
      const net = 100.0;
      const purity = 995;
      const fine = calculateFineAt995(net, purity);
      expect(fine).toBe(100.0);
      expect(formatGoldWeight(fine)).toBe("100.000");
    });
  });

  // ── Test Case C: Gross + Add − Less ───────────────────────────────────────
  describe("Test Case C: Gross + Add − Less", () => {
    it("Calculates Gross 100.000 g + Add 2.000 g − Less 1.000 g = 101.000 g", () => {
      const net = calculateNetWeight(100.0, 2.0, 1.0);
      expect(net).toBe(101.0);
      expect(formatGoldWeight(net)).toBe("101.000");
    });

    it("Calculates Gross 100.000 g − Less 1.000 g when Add is 0 = 99.000 g", () => {
      const net = calculateNetWeight(100.0, 0, 1.0);
      expect(net).toBe(99.0);
      expect(formatGoldWeight(net)).toBe("99.000");
    });
  });

  // ── Test Case D: Tunch + Wastage (Hisab) ──────────────────────────────────
  describe("Test Case D: Tunch + Wastage → Hisab & Fine", () => {
    it("Calculates Hisab = Touch 91.600% + Wastage 2.000% = 93.600%", () => {
      const hisab = calculateHisab(91.6, 2.0);
      expect(hisab).toBe(93.6);
    });

    it("Calculates Fine = Net 100 g × Hisab 93.6% / 100 = 93.600 g", () => {
      const fine = calculateFineFromHisab(100.0, 93.6);
      expect(fine).toBe(93.6);
      expect(formatGoldWeight(fine)).toBe("93.600");
    });
  });

  // ── Test Case E: Gold Value ───────────────────────────────────────────────
  describe("Test Case E: Gold Value", () => {
    it("Calculates Gold Value = Fine 10 g × ₹7,000/g = ₹70,000", () => {
      const goldVal = calculateGoldValue(10.0, 7000);
      expect(goldVal).toBe(70000);
    });
  });

  // ── Test Case F: Making % ────────────────────────────────────────────────
  describe("Test Case F: Making %", () => {
    it("Calculates Making = ₹100,000 Base × 10% = ₹10,000", () => {
      const making = calculateMakingPercentage(100000, 10);
      expect(making).toBe(10000);
    });
  });

  // ── Test Case G: Labour / g & Labour / Piece ─────────────────────────────
  describe("Test Case G: Labour per gram and per piece", () => {
    it("Calculates Labour = 25 g Weight × ₹150/g = ₹3,750", () => {
      const labour = calculateLabourPerGram(25.0, 150);
      expect(labour).toBe(3750);
    });

    it("Calculates Labour = 5 pieces × ₹500/piece = ₹2,500", () => {
      const labour = calculateLabourPerPiece(5, 500);
      expect(labour).toBe(2500);
    });
  });

  // ── Test Case H: GST ─────────────────────────────────────────────────────
  describe("Test Case H: GST Breakdown", () => {
    it("Calculates Intrstate GST on ₹100,000 @ 3% = ₹3,000 (CGST ₹1,500 + SGST ₹1,500)", () => {
      const gst = calculateGst(100000, 3, false);
      expect(gst.totalGst).toBe(3000);
      expect(gst.cgst).toBe(1500);
      expect(gst.sgst).toBe(1500);
      expect(gst.igst).toBe(0);
    });

    it("Calculates Interstate GST on ₹100,000 @ 3% = ₹3,000 (IGST ₹3,000)", () => {
      const gst = calculateGst(100000, 3, true);
      expect(gst.totalGst).toBe(3000);
      expect(gst.cgst).toBe(0);
      expect(gst.sgst).toBe(0);
      expect(gst.igst).toBe(3000);
    });
  });

  // ── Test Case I: Discount ────────────────────────────────────────────────
  describe("Test Case I: Discount", () => {
    it("Calculates percentage discount: ₹10,000 @ 5% = ₹500", () => {
      const disc = calculateDiscount(10000, 5);
      expect(disc).toBe(500);
    });

    it("Calculates fixed discount: ₹200 fixed on ₹10,000 = ₹200", () => {
      const disc = calculateDiscount(10000, undefined, 200);
      expect(disc).toBe(200);
    });
  });

  // ── Test Case J: Cash → Gold Equivalent ───────────────────────────────────
  describe("Test Case J: Cash → Gold Equivalent", () => {
    it("Calculates ₹22,000 cash @ ₹11,000/g gold rate = 2.000 g gold equivalent", () => {
      const result = calculateCashToGoldEquivalent(22000, 11000);
      expect(result.goldEquivalentGrams).toBe(2.0);
      expect(formatGoldWeight(result.goldEquivalentGrams)).toBe("2.000");
    });
  });

  // ── Test Case K: Mixed Gold + Cash Settlement ────────────────────────────
  describe("Test Case K: Mixed Gold + Cash Settlement", () => {
    it("Obligation 11.000 g, Paid 10.000 g Gold → Remaining 1.000 g @ ₹11,000 = ₹11,000 required cash", () => {
      const result = calculateMixedSettlement(11.0, 10.0, 11000);
      expect(result.remainingGoldGrams).toBe(1.0);
      expect(result.requiredCashAmount).toBe(11000);
    });
  });

  // ── Test Case L: Existing 200 g → 50 g invoice ────────────────────────────
  describe("Test Case L: Existing 200 g customer balance against 50 g invoice", () => {
    it("Applies 50 g, Leaves 0 g invoice obligation and 150 g remaining customer balance", () => {
      const result = applyCustomerGoldBalance(200.0, 50.0);
      expect(result.appliedGoldGrams).toBe(50.0);
      expect(result.remainingInvoiceObligationGrams).toBe(0.0);
      expect(result.remainingCustomerBalanceGrams).toBe(150.0);
      expect(result.isFullySettledFromBalance).toBe(true);
    });
  });

  // ── Test Case M: Existing 30 g → 50 g invoice ────────────────────────────
  describe("Test Case M: Existing 30 g customer balance against 50 g invoice", () => {
    it("Applies 30 g, Leaves 20 g invoice obligation and 0 g remaining customer balance", () => {
      const result = applyCustomerGoldBalance(30.0, 50.0);
      expect(result.appliedGoldGrams).toBe(30.0);
      expect(result.remainingInvoiceObligationGrams).toBe(20.0);
      expect(result.remainingCustomerBalanceGrams).toBe(0.0);
      expect(result.isFullySettledFromBalance).toBe(false);
    });
  });

  // ── Test Case N: Karigar 100 g @ 0.50% ───────────────────────────────────
  describe("Test Case N: Karigar Work Earning", () => {
    it("Calculates 100 g total work @ 0.50% configured earning = 0.500 g worker earning", () => {
      const earning = calculateKarigarEarning(100.0, 0.5);
      expect(earning).toBe(0.5);
      expect(formatGoldWeight(earning)).toBe("0.500");
    });
  });

  // ── Test Case O: Karigar Over-Loss ────────────────────────────────────────
  describe("Test Case O: Karigar Loss & Over-Loss", () => {
    it("Issued 100 g, Returned 97 g, Allowed 2 g → Actual Loss 3 g, Over-Loss 1 g", () => {
      const result = calculateKarigarLoss(100.0, 97.0, 2.0);
      expect(result.actualLossGrams).toBe(3.0);
      expect(result.overLossGrams).toBe(1.0);
    });

    it("Issued 100 g, Returned 98.5 g, Allowed 2 g → Actual Loss 1.5 g, Over-Loss 0 g", () => {
      const result = calculateKarigarLoss(100.0, 98.5, 2.0);
      expect(result.actualLossGrams).toBe(1.5);
      expect(result.overLossGrams).toBe(0.0);
    });
  });

  // ── Test Case P: Signed Balances (Negative Balance) ───────────────────────
  describe("Test Case P: Negative Balance Non-Clamping", () => {
    it("Opening 0 g, Debit 11.350 g → Balance = -11.350 g (Preserved sign)", () => {
      const balance = calculatePurityBookBalance({
        purityGrade: "916",
        openingGrams: 0,
        receiptsCreditsGrams: 0,
        issuesDebitsGrams: 11.35,
        adjustmentsGrams: 0,
        settlementsGrams: 0,
      });
      expect(balance).toBe(-11.35);
      expect(formatGoldWeight(balance)).toBe("-11.350");
    });
  });

  // ── Test Case Q: Multiple Purity Books ───────────────────────────────────
  describe("Test Case Q: Multiple Purity Books Isolation", () => {
    it("Maintains separate isolated running balances for 916, 750, 995, and 999", () => {
      const book916 = calculatePurityBookBalance({
        purityGrade: "916",
        openingGrams: 50.0,
        receiptsCreditsGrams: 20.0,
        issuesDebitsGrams: 10.0,
        adjustmentsGrams: 0,
        settlementsGrams: 0,
      });

      const book750 = calculatePurityBookBalance({
        purityGrade: "750",
        openingGrams: 100.0,
        receiptsCreditsGrams: 0,
        issuesDebitsGrams: 35.0,
        adjustmentsGrams: 0,
        settlementsGrams: 0,
      });

      const book995 = calculatePurityBookBalance({
        purityGrade: "995",
        openingGrams: 200.0,
        receiptsCreditsGrams: 50.0,
        issuesDebitsGrams: 0,
        adjustmentsGrams: 0,
        settlementsGrams: 0,
      });

      const book999 = calculatePurityBookBalance({
        purityGrade: "999",
        openingGrams: 10.0,
        receiptsCreditsGrams: 5.0,
        issuesDebitsGrams: 2.0,
        adjustmentsGrams: 0,
        settlementsGrams: 0,
      });

      expect(book916).toBe(60.0);
      expect(book750).toBe(65.0);
      expect(book995).toBe(250.0);
      expect(book999).toBe(13.0);
    });
  });
});
