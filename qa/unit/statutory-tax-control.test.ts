/**
 * AVS ERP — Comprehensive Statutory Tax Control & GST Nature-of-Supply Acceptance Test Suite
 *
 * Verifies:
 * Test 1: Retail jewellery (₹90,000 gold + ₹10,000 making -> Taxable ₹1,00,000, GST ₹3,000, NOT ₹3,400)
 * Test 2: Genuine job work (Job charges ₹10,000 -> 5% SAC 9988 GST = ₹500)
 * Test 3: Personal customer old gold (GST = 0, RCM = OFF)
 * Test 4: Unregistered business gold supplier (RCM evaluated separately -> REVIEW_REQUIRED)
 * Test 5: Customer gold custody (GST = 0, RCM = OFF, 0 tax / non-supply)
 * Test 6: Gold exchange (Old gold ₹40,000 does NOT reduce ₹1,00,000 new jewellery GST base -> GST is ₹3,000)
 * Test 7: Tax OFF (Explicitly OFF -> Tax = ₹0)
 * Test 8: Historical invoice (Changing current tax rules does NOT alter historical snapshots)
 * Plus full 15-scenario compliance suite.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  useStatutoryTaxStore,
  calculateTaxDecision,
  resolveStatutoryTaxRule,
  validateTaxUniqueness,
  type TaxDecisionSnapshot,
  type TaxOverrideRecord,
} from "../../src/lib/statutory-tax-engine";
import { compileSalesRegister } from "../../src/lib/statutory-registers";
import type { Invoice } from "../../src/lib/billing-store";

describe("AVS ERP — GST Engine Final Statutory Correction & Acceptance Suite", () => {
  beforeEach(() => {
    useStatutoryTaxStore.getState().resetToDefaults();
  });

  // ---------------------------------------------------------------------------
  // Test 1: Retail Jewellery 3% Composite GST
  // ---------------------------------------------------------------------------
  it("Test 1: Retail Jewellery (₹90,000 gold + ₹10,000 making) -> Taxable ₹1,00,000, GST ₹3,000 (NOT ₹3,400)", () => {
    const goldValuePaise = 9000000;   // ₹90,000
    const makingValuePaise = 1000000; // ₹10,000
    const totalTransactionValuePaise = goldValuePaise + makingValuePaise; // ₹1,00,000

    const decision = calculateTaxDecision({
      classification: "RETAIL_JEWELLERY",
      transactionDate: "2026-09-01",
      taxableAmountPaise: totalTransactionValuePaise,
      makingChargesPaise: makingValuePaise,
    });

    expect(decision.taxApplicable).toBe(true);
    expect(decision.taxRate).toBe(3.0);
    expect(decision.taxableValue).toBe(100000);
    expect(decision.taxableValuePaise).toBe(10000000);
    expect(decision.totalTax).toBe(3000);
    expect(decision.totalTaxPaise).toBe(300000);
    expect(decision.cgst).toBe(1500);
    expect(decision.sgst).toBe(1500);
    expect(decision.igst).toBe(0);
    expect(decision.totalTaxPaise).not.toBe(340000); // Guarantees it is NOT ₹3,400 (3% gold + 5% making)
    expect(decision.taxReason).toContain("QUALIFYING_RETAIL_JEWELLERY");
  });

  // ---------------------------------------------------------------------------
  // Test 2: Genuine Job Work 5% GST
  // ---------------------------------------------------------------------------
  it("Test 2: Genuine Job Work (Job charges ₹10,000) -> Job-work GST = ₹500", () => {
    const jobChargesPaise = 1000000; // ₹10,000

    const decision = calculateTaxDecision({
      classification: "JOB_WORK",
      transactionDate: "2026-09-01",
      taxableAmountPaise: jobChargesPaise,
    });

    expect(decision.taxApplicable).toBe(true);
    expect(decision.taxRate).toBe(5.0);
    expect(decision.taxableValue).toBe(10000);
    expect(decision.taxableValuePaise).toBe(1000000);
    expect(decision.totalTax).toBe(500);
    expect(decision.totalTaxPaise).toBe(50000); // 5% of ₹10,000 = ₹500
    expect(decision.cgst).toBe(250);
    expect(decision.sgst).toBe(250);
    expect(decision.taxReason).toContain("QUALIFYING_JOB_WORK");
  });

  // ---------------------------------------------------------------------------
  // Test 3: Personal Customer Old Gold
  // ---------------------------------------------------------------------------
  it("Test 3: Personal Customer Old Gold -> GST = 0, RCM = OFF", () => {
    const decision = calculateTaxDecision({
      classification: "OLD_GOLD_PURCHASE",
      supplierCapacity: "personal_customer",
      transactionDate: "2026-09-01",
      taxableAmountPaise: 4000000, // ₹40,000
    });

    expect(decision.taxApplicable).toBe(false);
    expect(decision.taxRate).toBe(0);
    expect(decision.totalTax).toBe(0);
    expect(decision.totalTaxPaise).toBe(0);
    expect(decision.rcmApplicable).toBe(false);
    expect(decision.taxReason).toContain("PERSONAL_OLD_GOLD_EXEMPT");
  });

  // ---------------------------------------------------------------------------
  // Test 4: Unregistered Business Gold Supplier
  // ---------------------------------------------------------------------------
  it("Test 4: Unregistered Business Gold Supplier -> RCM evaluated separately (REVIEW_REQUIRED)", () => {
    const decision = calculateTaxDecision({
      classification: "OLD_GOLD_PURCHASE",
      supplierCapacity: "unregistered_business",
      transactionDate: "2026-09-01",
      taxableAmountPaise: 5000000,
    });

    expect(decision.taxStatus).toBe("REVIEW_REQUIRED");
    expect(decision.statusCategory).toBe("PROFESSIONAL REVIEW REQUIRED");
    expect(decision.taxApplicable).toBe(false);
    expect(decision.rcmApplicable).toBe(false);
    expect(decision.taxReason).toContain("REVIEW_REQUIRED");
  });

  // ---------------------------------------------------------------------------
  // Test 5: Customer Gold Custody
  // ---------------------------------------------------------------------------
  it("Test 5: Customer Gold Custody -> GST = 0, RCM = OFF, fiduciary safe-deposit non-supply", () => {
    const decision = calculateTaxDecision({
      classification: "CUSTOMER_GOLD_CUSTODY",
      transactionDate: "2026-09-01",
      taxableAmountPaise: 10000000,
    });

    expect(decision.taxApplicable).toBe(false);
    expect(decision.taxRate).toBe(0);
    expect(decision.totalTax).toBe(0);
    expect(decision.rcmApplicable).toBe(false);
    expect(decision.taxReason).toContain("CUSTOMER_CUSTODY_NON_SUPPLY");
  });

  // ---------------------------------------------------------------------------
  // Test 6: Gold Exchange
  // ---------------------------------------------------------------------------
  it("Test 6: Gold Exchange -> Old gold consideration (₹40,000) does NOT reduce new jewellery taxable base (₹1,00,000)", () => {
    const newJewelleryValuePaise = 10000000;    // ₹1,00,000
    const oldGoldConsiderationPaise = 4000000; // ₹40,000 consideration

    const decision = calculateTaxDecision({
      classification: "GOLD_EXCHANGE",
      newJewelleryValuePaise,
      oldGoldConsiderationPaise,
      transactionDate: "2026-09-01",
    });

    expect(decision.taxApplicable).toBe(true);
    expect(decision.taxRate).toBe(3.0);
    // Taxable base is the full ₹1,00,000 (NOT ₹60,000)
    expect(decision.taxableValue).toBe(100000);
    expect(decision.taxableValuePaise).toBe(10000000);
    // GST @ 3% on ₹1,00,000 = ₹3,000
    expect(decision.totalTax).toBe(3000);
    expect(decision.totalTaxPaise).toBe(300000);
    expect(decision.taxReason).toContain("GOLD_EXCHANGE");
  });

  // ---------------------------------------------------------------------------
  // Test 7: Tax OFF State
  // ---------------------------------------------------------------------------
  it("Test 7: Tax OFF -> Rule explicitly OFF evaluates to ₹0 tax with no tax ledger impact", () => {
    useStatutoryTaxStore.getState().setRuleStatus("gst_jewellery_retail_b2c", "OFF");

    const decision = calculateTaxDecision({
      classification: "RETAIL_JEWELLERY",
      transactionDate: "2026-09-01",
      taxableAmountPaise: 10000000,
    });

    expect(decision.taxApplicable).toBe(false);
    expect(decision.taxStatus).toBe("OFF");
    expect(decision.taxRate).toBe(0);
    expect(decision.totalTax).toBe(0);
    expect(decision.totalTaxPaise).toBe(0);
    expect(decision.taxReason).toContain("RULE_OFF");
  });

  // ---------------------------------------------------------------------------
  // Test 8: Historical Invoice Immutability
  // ---------------------------------------------------------------------------
  it("Test 8: Historical Invoices -> Modifying active settings does NOT change historical snapshots", () => {
    const historicalSnapshot: TaxDecisionSnapshot = calculateTaxDecision({
      classification: "RETAIL_JEWELLERY",
      transactionDate: "2026-09-01",
      taxableAmountPaise: 10000000,
    });
    expect(historicalSnapshot.totalTax).toBe(3000);

    // Setting rate to 5% in the future
    useStatutoryTaxStore.getState().setRuleRate("gst_jewellery_retail_b2c", 5.0);

    // Historical snapshot remains frozen at 3% / ₹3,000
    expect(historicalSnapshot.taxRate).toBe(3.0);
    expect(historicalSnapshot.totalTax).toBe(3000);
    expect(historicalSnapshot.totalTaxPaise).toBe(300000);
  });

  // ---------------------------------------------------------------------------
  // Additional Acceptance Checks
  // ---------------------------------------------------------------------------
  it("Scenario 9: Section 206C(1H) is strictly OFF for current FY transactions", () => {
    const res = calculateTaxDecision({
      classification: "RETAIL_JEWELLERY",
      transactionDate: "2026-09-01",
      taxableAmountPaise: 600000000, // ₹60 Lakhs
    });
    expect(res.tcsApplicable).toBe(false);
  });

  it("Scenario 10: Prevents double-taxation when composite jewellery and job-work rules are mixed", () => {
    const jewellerySnapshot = calculateTaxDecision({
      classification: "RETAIL_JEWELLERY",
      transactionDate: "2026-09-01",
      taxableAmountPaise: 10000000,
    });

    const jobWorkSnapshot = calculateTaxDecision({
      classification: "JOB_WORK",
      transactionDate: "2026-09-01",
      taxableAmountPaise: 1500000,
    });

    const validation = validateTaxUniqueness([jewellerySnapshot, jobWorkSnapshot]);
    expect(validation.valid).toBe(false);
    expect(validation.violations[0]).toContain("DOUBLE_TAXATION_VIOLATION");
  });

  it("Scenario 11: Authorized tax override records complete audit trail while applying revised decision", () => {
    const override: TaxOverrideRecord = {
      overrideId: "ov_20260901_001",
      user: "chief_accountant",
      reason: "Special SEZ tax exemption certified by CA",
      timestamp: "2026-09-01T10:00:00.000Z",
      originalRuleId: "gst_jewellery_retail_b2c",
      originalStatus: "ON",
      originalRatePct: 3.0,
      newStatus: "OFF",
      newRatePct: 0,
      referenceDocument: "SEZ-CERT-9941",
    };

    const res = calculateTaxDecision({
      classification: "RETAIL_JEWELLERY",
      transactionDate: "2026-09-01",
      taxableAmountPaise: 10000000,
      override,
    });

    expect(res.taxApplicable).toBe(false);
    expect(res.totalTax).toBe(0);
    expect(res.override).toBeDefined();
    expect(res.override?.user).toBe("chief_accountant");
    expect(res.override?.referenceDocument).toBe("SEZ-CERT-9941");
    expect(res.taxReason).toContain("OVERRIDE_APPLIED");
  });

  it("Scenario 12: Sales register reconciliation deriving from frozen invoice tax totals", () => {
    const testInvoice: Invoice = {
      id: "inv_test_001",
      invoiceNo: "INV-2026-001",
      customerId: "cust_1",
      customerName: "Rahul Sharma",
      customerPhone: "9876543210",
      customerAddress: "Mumbai",
      customerGstin: "27AAAAA1234A1Z5",
      status: "confirmed",
      items: [
        {
          id: "item_1",
          description: "22K Gold Bangle",
          itemName: "22K Gold Bangle",
          category: "Bangles",
          purityPerMille: 916,
          grossWeightMg: 10000,
          netWeightMg: 10000,
          fineMg: 9160,
          ratePerGramPaise: 700000,
          goldValuePaise: 7000000,
          makingChargesPaise: 500000,
          stoneChargesPaise: 0,
          hallmarkChargesPaise: 4500,
          otherChargesPaise: 0,
          discountPaise: 0,
          lineTotalPaise: 7504500,
          chargeMode: "full_value",
        },
      ],
      gst: "gst3",
      subtotalPaise: 7504500,
      cgstPaise: 112568,
      sgstPaise: 112567,
      gstPaise: 225135,
      tcsPaise: 0,
      adjustmentPaise: 0,
      grandTotalPaise: 7729635,
      paidPaise: 7729635,
      balancePaise: 0,
      payments: [],
      createdAt: 1788200000000,
      updatedAt: 1788200000000,
    };

    const rows = compileSalesRegister(
      [testInvoice],
      1788000000000,
      1788300000000,
    );

    expect(rows.length).toBe(1);
    expect(rows[0].invoiceNo).toBe("INV-2026-001");
    expect(rows[0].taxablePaise).toBe(testInvoice.subtotalPaise);
    expect(rows[0].cgstPaise).toBe(testInvoice.cgstPaise);
    expect(rows[0].sgstPaise).toBe(testInvoice.sgstPaise);
    expect(rows[0].cgstPaise + rows[0].sgstPaise).toBe(testInvoice.gstPaise);
    expect(rows[0].grandPaise).toBe(testInvoice.grandTotalPaise);
    expect(rows[0].tcsPaise).toBe(0);
  });
});
