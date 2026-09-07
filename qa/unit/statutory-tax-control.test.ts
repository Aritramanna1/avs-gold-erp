/**
 * AVS ERP — Comprehensive Statutory Tax Control Acceptance Test Suite
 *
 * Verifies all 15 statutory requirements:
 * 1. Tax ON -> tax calculated
 * 2. Tax OFF -> zero tax (taxApplicable = false)
 * 3. Tax ON but conditions fail -> zero tax
 * 4. Missing configuration -> configuration-required state
 * 5. Historical tax rule remains frozen
 * 6. Jewellery GST does not double-tax making charges
 * 7. Job-work tax is distinct from retail jewellery tax
 * 8. Personal old-gold transaction does not incorrectly trigger RCM
 * 9. Customer custody produces no GST
 * 10. 206C(1H) remains OFF for FY 2026-27
 * 11. 194Q evaluates conditions independently
 * 12. RCM cannot be silently guessed (unregistered business -> REVIEW_REQUIRED)
 * 13. Tax override creates an audit trail
 * 14. Credit/debit notes correctly reverse applicable tax
 * 15. Tax reports reconcile with invoices
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_STATUTORY_TAX_RULES,
  useStatutoryTaxStore,
  calculateTaxDecision,
  resolveStatutoryTaxRule,
  validateTaxUniqueness,
  type TaxDecisionSnapshot,
  type TaxOverrideRecord,
} from "../../src/lib/statutory-tax-engine";
import { compileSalesRegister } from "../../src/lib/statutory-registers";
import type { Invoice } from "../../src/lib/billing-store";

describe("AVS ERP — Final Statutory Tax Control Suite (15 Critical Acceptance Tests)", () => {
  beforeEach(() => {
    useStatutoryTaxStore.getState().resetToDefaults();
  });

  // 1. Tax ON -> Tax Calculated
  it("Scenario 1: Calculates applicable GST when rule is ON and conditions match", () => {
    const res = calculateTaxDecision({
      transactionType: "retail_sale",
      transactionDate: "2026-09-01",
      taxableAmountPaise: 10000000, // ₹1,00,000
      isInterState: false,
    });

    expect(res.taxApplicable).toBe(true);
    expect(res.ruleStatus).toBe("ON");
    expect(res.taxRatePct).toBe(3.0);
    expect(res.taxableValuePaise).toBe(10000000);
    expect(res.totalTaxPaise).toBe(300000); // 3% of ₹1,00,000 = ₹3,000 (300000 paise)
    expect(res.cgstPaise).toBe(150000);    // ₹1,500
    expect(res.sgstPaise).toBe(150000);    // ₹1,500
    expect(res.igstPaise).toBe(0);
    expect(res.taxReason).toContain("QUALIFYING_RETAIL_JEWELLERY");
  });

  // 2. Tax OFF -> Zero Tax
  it("Scenario 2: Evaluates to ₹0 tax and taxApplicable=false when rule is toggled OFF", () => {
    useStatutoryTaxStore.getState().setRuleStatus("gst_jewellery_retail_b2c", "OFF");

    const res = calculateTaxDecision({
      transactionType: "retail_sale",
      transactionDate: "2026-09-01",
      taxableAmountPaise: 10000000, // ₹1,00,000
    });

    expect(res.taxApplicable).toBe(false);
    expect(res.ruleStatus).toBe("OFF");
    expect(res.taxRatePct).toBe(0);
    expect(res.totalTaxPaise).toBe(0);
    expect(res.cgstPaise).toBe(0);
    expect(res.sgstPaise).toBe(0);
    expect(res.igstPaise).toBe(0);
    expect(res.taxReason).toContain("RULE_OFF");
  });

  // 3. Tax ON but Conditions Fail -> Zero Tax
  it("Scenario 3: Evaluates to zero tax when rule is ON but transaction date precedes effective date", () => {
    const res = calculateTaxDecision({
      transactionType: "retail_sale",
      transactionDate: "2015-01-01", // Prior to GST effective date 2017-07-01
      taxableAmountPaise: 10000000,
    });

    expect(res.taxApplicable).toBe(false);
    expect(res.totalTaxPaise).toBe(0);
    expect(res.taxReason).toContain("RULE_INACTIVE_YET");
  });

  // 4. Missing Configuration -> CONFIGURATION_REQUIRED State
  it("Scenario 4: Returns CONFIGURATION_REQUIRED state when mandatory parameters are missing", () => {
    const res = calculateTaxDecision({
      transactionType: "purchase",
      transactionDate: "2026-09-01",
      taxableAmountPaise: 50000000,
      // buyerTurnoverPrecedingFyPaise is omitted
      // sellerPurchasesCurrentFyPaise is omitted
    });

    expect(res.tdsApplicable).toBe(false);
    expect(res.taxReason).toContain("194Q_CONFIG_REQUIRED");
  });

  // 5. Historical Tax Rule Remains Frozen
  it("Scenario 5: Ensures historical tax snapshots remain immutable across future rule updates", () => {
    const historicalSnapshot: TaxDecisionSnapshot = calculateTaxDecision({
      transactionType: "retail_sale",
      transactionDate: "2026-09-01",
      taxableAmountPaise: 10000000,
    });
    expect(historicalSnapshot.totalTaxPaise).toBe(300000);

    // Later, tax rate is updated in store
    useStatutoryTaxStore.getState().setRuleRate("gst_jewellery_retail_b2c", 5.0);

    // The old frozen snapshot instance has not mutated
    expect(historicalSnapshot.taxRatePct).toBe(3.0);
    expect(historicalSnapshot.totalTaxPaise).toBe(300000);
  });

  // 6. Jewellery GST Does Not Double-Tax Making Charges
  it("Scenario 6: Prevents separate double-taxation of making charges on composite jewellery supply", () => {
    // In retail jewellery (HSN 7113), making charges are part of composite supply (GST Council FAQ Q7)
    const jewellerySnapshot = calculateTaxDecision({
      transactionType: "retail_sale",
      transactionDate: "2026-09-01",
      taxableAmountPaise: 10000000, // Composite value including making
    });

    const jobWorkSnapshot = calculateTaxDecision({
      transactionType: "job_work",
      transactionDate: "2026-09-01",
      taxableAmountPaise: 1500000,
    });

    const validation = validateTaxUniqueness([jewellerySnapshot, jobWorkSnapshot]);
    expect(validation.valid).toBe(false);
    expect(validation.violations[0]).toContain("DOUBLE_TAXATION_VIOLATION");
  });

  // 7. Job-work Tax is Distinct from Retail Jewellery Tax
  it("Scenario 7: Calculates 5% job work tax under SAC 9988 exclusively on labour base", () => {
    const res = calculateTaxDecision({
      transactionType: "job_work",
      transactionDate: "2026-09-01",
      taxableAmountPaise: 2000000, // ₹20,000 labour charge
    });

    expect(res.taxApplicable).toBe(true);
    expect(res.taxRatePct).toBe(5.0);
    expect(res.ruleId).toBe("gst_jobwork_labour");
    expect(res.totalTaxPaise).toBe(100000); // 5% of ₹20,000 = ₹1,000 (100000 paise)
    expect(res.taxReason).toContain("QUALIFYING_JOB_WORK");
  });

  // 8. Personal Old-Gold Transaction Does Not Incorrectly Trigger RCM
  it("Scenario 8: Treats personal customer old gold purchase as EXEMPT (0% GST, No RCM)", () => {
    const res = calculateTaxDecision({
      transactionType: "old_gold_purchase",
      supplierCapacity: "personal_customer",
      transactionDate: "2026-09-01",
      taxableAmountPaise: 5000000, // ₹50,000
    });

    expect(res.taxApplicable).toBe(false);
    expect(res.totalTaxPaise).toBe(0);
    expect(res.rcmApplicable).toBe(false);
    expect(res.taxReason).toContain("PERSONAL_OLD_GOLD_EXEMPT");
  });

  // 9. Customer Custody Produces No GST
  it("Scenario 9: Customer custody safe-deposit generates 0% tax and 0 invoice tax entry", () => {
    const res = calculateTaxDecision({
      transactionType: "customer_gold_received",
      supplierCapacity: "customer_custody",
      transactionDate: "2026-09-01",
      taxableAmountPaise: 10000000,
    });

    expect(res.taxApplicable).toBe(false);
    expect(res.totalTaxPaise).toBe(0);
    expect(res.taxReason).toContain("CUSTOMER_CUSTODY_NON_SUPPLY");
  });

  // 10. 206C(1H) Remains OFF for FY 2026-27
  it("Scenario 10: Section 206C(1H) TCS is strictly OFF for FY 2026-27 current sales", () => {
    const res = calculateTaxDecision({
      transactionType: "retail_sale",
      transactionDate: "2026-09-01",
      taxableAmountPaise: 600000000, // ₹60 Lakhs
    });

    expect(res.tcsApplicable).toBe(false);
    expect(res.taxReason).toContain("Section 206C(1H) TCS inactive");
  });

  // 11. 194Q Evaluates Conditions Independently
  it("Scenario 11: Evaluates Section 194Q buyer TDS on turnover and purchase thresholds", () => {
    // Eligible buyer (> ₹10Cr turnover) and Purchases > ₹50L
    const resEligible = calculateTaxDecision({
      transactionType: "purchase",
      transactionDate: "2026-09-01",
      taxableAmountPaise: 10000000, // ₹1,00,000
      buyerTurnoverPrecedingFyPaise: 15000000000, // ₹15 Cr
      sellerPurchasesCurrentFyPaise: 600000000,  // ₹60 L
      hasSellerPan: true,
    });
    expect(resEligible.tdsApplicable).toBe(true);
    expect(resEligible.tdsRatePct).toBe(0.1);
    expect(resEligible.tdsAmountPaise).toBe(10000); // 0.1% of ₹1,00,000 = ₹100 (10000 paise)

    // Ineligible buyer (turnover <= ₹10Cr)
    const resIneligible = calculateTaxDecision({
      transactionType: "purchase",
      transactionDate: "2026-09-01",
      taxableAmountPaise: 10000000,
      buyerTurnoverPrecedingFyPaise: 5000000000, // ₹5 Cr
      sellerPurchasesCurrentFyPaise: 600000000, // ₹60 L
      hasSellerPan: true,
    });
    expect(resIneligible.tdsApplicable).toBe(false);
  });

  // 12. RCM Cannot be Silently Guessed
  it("Scenario 12: Flags unregistered business supplier as REVIEW_REQUIRED without silently applying RCM", () => {
    const res = calculateTaxDecision({
      transactionType: "old_gold_purchase",
      supplierCapacity: "unregistered_business",
      transactionDate: "2026-09-01",
      taxableAmountPaise: 20000000,
    });

    expect(res.ruleStatus).toBe("REVIEW_REQUIRED");
    expect(res.statusCategory).toBe("PROFESSIONAL REVIEW REQUIRED");
    expect(res.taxApplicable).toBe(false);
    expect(res.taxReason).toContain("REVIEW_REQUIRED");
  });

  // 13. Tax Override Creates an Audit Trail
  it("Scenario 13: Authorized tax override records complete audit trail while applying revised decision", () => {
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
      transactionType: "retail_sale",
      transactionDate: "2026-09-01",
      taxableAmountPaise: 10000000,
      override,
    });

    expect(res.taxApplicable).toBe(false);
    expect(res.totalTaxPaise).toBe(0);
    expect(res.override).toBeDefined();
    expect(res.override?.user).toBe("chief_accountant");
    expect(res.override?.referenceDocument).toBe("SEZ-CERT-9941");
    expect(res.taxReason).toContain("OVERRIDE_APPLIED");
  });

  // 14. Credit/Debit Notes Correctly Handle Applicable Tax
  it("Scenario 14: Accurately computes matching tax for credit notes on retail jewellery", () => {
    const originalSale = calculateTaxDecision({
      transactionType: "retail_sale",
      transactionDate: "2026-09-01",
      taxableAmountPaise: 10000000, // ₹1,00,000
    });

    const creditNote = calculateTaxDecision({
      transactionType: "credit_note",
      transactionDate: "2026-09-02",
      taxableAmountPaise: 10000000, // Full return
    });

    expect(creditNote.totalTaxPaise).toBe(originalSale.totalTaxPaise);
    expect(creditNote.cgstPaise).toBe(originalSale.cgstPaise);
    expect(creditNote.sgstPaise).toBe(originalSale.sgstPaise);
  });

  // 15. Tax Reports Reconcile with Invoices
  it("Scenario 15: Compiles sales register strictly reconciling with frozen invoice tax totals", () => {
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
