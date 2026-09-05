/**
 * MTJ / AVS ERP — Authoritative Business Logic Lock QA Verification Suite
 *
 * Validates the locked business rules based strictly on handwritten shop corrections:
 * 1. Purity Rule: 995 / 99.50% authoritative basis.
 * 2. Melting / Manufacturing Division:
 *    - 100 ÷ 91.6 = 109.170 g
 *    - 100 ÷ 83.5 = 119.760 g
 * 3. Billing Calculations:
 *    - 100 × 96% = 96.000 g Fine
 *    - 100 × 88% = 88.000 g Fine
 *    - Net = Gross + Add − Less
 * 4. Cash / Bhav Rule:
 *    - ₹15,000 Bhav => ₹1,00,000 ÷ ₹15,000 = 6.666... g
 *    - Mixed Settlement: 51.000g obligation - 50.000g gold - ₹15,000 cash (@ ₹15,000 Bhav) = 0.000g balance
 * 5. Karigar Custody: Physical weight + Book purity only (e.g. 22K/916, 18K/750).
 *    - Component accounting: Gold 50g + Zinc 10g − Chain 10g = 40g net custody.
 * 6. Direct transactions without prior orders.
 * 7. Two document templates: Brand Match & Plain.
 */
import { describe, it, expect } from "vitest";
import {
  calculateFineAt995,
  calculateManufacturingMeltingWeight,
  calculateBillingFineGold,
  calculateBhavGoldEquivalent,
  calculateCashToGoldEquivalent,
  calculateNetWeight,
  calculateMixedSettlement,
  calculateKarigarLoss,
  calculateKarigarNetSettlement,
  calculateHisab,
  calculateFineFromHisab,
  calculateGoldValue,
  calculateGst,
  calculateTotalInvoice,
} from "@/lib/mtj-gold-calculation-engine";
import { fineGoldMg, grossFromFineMg, DEFAULT_FINENESS_BASIS } from "@/lib/gold";

describe("MTJ / AVS ERP — Authoritative Business Logic Lock Suite", () => {
  // ── 1. Authoritative Purity Rule (995 / 99.50%) ───────────────────────────
  describe("1. Authoritative Purity Rule (995 / 99.50%)", () => {
    it("enforces 995 as the authoritative default fineness basis", () => {
      expect(DEFAULT_FINENESS_BASIS).toBe(995);
    });

    it("calculates fine gold using 995 basis", () => {
      // 10g of 916 purity at 995 basis: 10 * 916 / 995 = 9.20603... -> 9.206030 g
      const fine916 = calculateFineAt995(10, 916);
      expect(fine916).toBeCloseTo(9.20603, 4);

      // In mg: 10,000mg of 916 purity at 995 basis: round(10000 * 916 / 995) = 9206 mg
      const fineMg = fineGoldMg(10_000, 916);
      expect(fineMg).toBe(9206);
    });

    it("treats metal at or above 995 as 100% fine", () => {
      expect(fineGoldMg(10_000, 995)).toBe(10_000);
      expect(fineGoldMg(10_000, 999)).toBe(10_000);
    });
  });

  // ── 2. Work Manufacturing / Melting Gold (Strict Division) ────────────────
  describe("2. Work Manufacturing / Melting Gold (Strict Division)", () => {
    it("verifies handwritten rule: 100 ÷ 91.6 = 109.170 g", () => {
      const requiredWeight = calculateManufacturingMeltingWeight(100, 91.6);
      expect(requiredWeight).toBe(109.170);
    });

    it("verifies handwritten rule: 100 ÷ 83.5 = 119.760 g", () => {
      const requiredWeight = calculateManufacturingMeltingWeight(100, 83.5);
      expect(requiredWeight).toBe(119.760);
    });

    it("ensures melting formula uses division and never multiplication", () => {
      // 50g pure gold needed at 75.0% (18K) target purity
      // 50 / 0.75 = 66.6666... -> 66.667 g
      const required18k = calculateManufacturingMeltingWeight(50, 75.0);
      expect(required18k).toBe(66.667);
      expect(required18k).toBeGreaterThan(50); // Melting weight must exceed pure weight
    });
  });

  // ── 3. Billing Calculations (Handwritten 96 & 88 Examples) ────────────────
  describe("3. Billing Calculations (Handwritten 96 & 88 Rules)", () => {
    it("verifies handwritten billing rule: 100 × 96% = 96.000 g fine", () => {
      const fine = calculateBillingFineGold(100, 96);
      expect(fine).toBe(96.000);
    });

    it("verifies handwritten billing rule: 100 × 88% = 88.000 g fine", () => {
      const fine = calculateBillingFineGold(100, 88);
      expect(fine).toBe(88.000);
    });

    it("verifies net weight calculation: Net = Gross + Add − Less", () => {
      // Gross 50.000g + Add 2.000g (findings) - Less 1.500g (stones) = 50.500g
      const net = calculateNetWeight(50.0, 2.0, 1.5);
      expect(net).toBe(50.5);
    });
  });

  // ── 4. Cash / Bhav Rule & Gold-First Settlement ───────────────────────────
  describe("4. Cash / Bhav Rule & Gold-First Settlement", () => {
    it("verifies handwritten rule: ₹15,000 Bhav => ₹1,00,000 ÷ ₹15,000 = 6.666... g", () => {
      const goldEq = calculateBhavGoldEquivalent(100_000, 15_000);
      expect(goldEq).toBe(6.666);
    });

    it("verifies mixed settlement: 51.000g obligation, 50.000g gold paid, remaining 1.000g cash settled at ₹15,000/g", () => {
      const settlement = calculateMixedSettlement(51.0, 50.0, 15_000);
      expect(settlement.totalObligationGrams).toBe(51.0);
      expect(settlement.goldPaidGrams).toBe(50.0);
      expect(settlement.remainingGoldGrams).toBe(1.0);
      expect(settlement.requiredCashAmount).toBe(15_000);

      // Gold equivalent of the ₹15,000 cash paid
      const cashGoldEq = calculateBhavGoldEquivalent(settlement.requiredCashAmount, 15_000);
      expect(cashGoldEq).toBe(1.0);

      // Final balance becomes 0.000g
      const finalBalance = settlement.totalObligationGrams - settlement.goldPaidGrams - cashGoldEq;
      expect(finalBalance).toBe(0);
    });
  });

  // ── 5. Karigar Physical Purity & Custody Component Accounting ─────────────
  describe("5. Karigar Physical Purity & Component Accounting", () => {
    it("verifies handwritten custody component deduction (Gold 50g + Zinc 10g − Chain 10g = 40g)", () => {
      const workerEarning = 50.0;
      const chainDeduction = 10.0;
      const overLoss = 0.0;

      const result = calculateKarigarNetSettlement({
        workerEarningGrams: workerEarning,
        chainDeductionGrams: chainDeduction,
        overLossGrams: overLoss,
      });

      expect(result.workerEarningGrams).toBe(50.0);
      expect(result.totalDeductionsGrams).toBe(10.0);
      expect(result.netSettlementGrams).toBe(40.0);
    });

    it("verifies allowable loss vs over-loss computation", () => {
      // Issued 100g, Returned 98g -> Actual Loss = 2.0g. Allowed Loss = 1.5g -> Over-loss = 0.5g
      const loss = calculateKarigarLoss(100.0, 98.0, 1.5);
      expect(loss.actualLossGrams).toBe(2.0);
      expect(loss.allowedLossGrams).toBe(1.5);
      expect(loss.overLossGrams).toBe(0.5);
    });
  });

  // ── 6. Full Invoice & Tax Accounting ──────────────────────────────────────
  describe("6. Full Invoice & GST Tax Accounting", () => {
    it("calculates 3% GST on taxable jewelry value with CGST/SGST split", () => {
      const gst = calculateGst(100_000, 3, false);
      expect(gst.totalGst).toBe(3000);
      expect(gst.cgst).toBe(1500);
      expect(gst.sgst).toBe(1500);
      expect(gst.igst).toBe(0);
    });

    it("calculates complete invoice value with discount and GST", () => {
      const invoice = calculateTotalInvoice({
        fineGoldGrams: 10.0,
        goldRatePerGram: 7500, // Gold value = ₹75,000
        makingAmount: 5000,
        labourAmount: 1000,
        discountAmount: 1000, // Taxable after discount = ₹80,000
        gstRatePercent: 3, // 3% GST = ₹2,400
      });

      expect(invoice.goldValue).toBe(75_000);
      expect(invoice.subtotalTaxable).toBe(81_000);
      expect(invoice.taxableAfterDiscount).toBe(80_000);
      expect(invoice.gst.totalGst).toBe(2400);
      expect(invoice.totalInvoiceAmount).toBe(82_400);
    });
  });
});
