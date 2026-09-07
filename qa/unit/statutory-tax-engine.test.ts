/**
 * AVS ERP — Statutory Tax & Compliance Engine Unit Test Suite
 *
 * Verifies:
 * 1. Section 206C(1H) TCS is INACTIVE for current periods (>= 2025-04-01).
 * 2. Section 194Q TDS is evaluated with buyer-side eligibility and purchase thresholds.
 * 3. Old Gold supplier capacity classification (Personal vs Unregistered vs Registered vs Custody).
 * 4. Effective-date awareness and historical immutability.
 */

import { describe, it, expect } from "vitest";
import {
  STATUTORY_TAX_RULES,
  resolveStatutoryTaxRule,
} from "../../src/lib/statutory-tax-engine";

describe("AVS ERP — Statutory Tax & Compliance Engine", () => {
  // ---------------------------------------------------------------------------
  // 1. Section 206C(1H) Inactivity in Current Period
  // ---------------------------------------------------------------------------
  it("verifies Section 206C(1H) TCS is marked INACTIVE for FY 2026-27 current sales", () => {
    const historicalRule = STATUTORY_TAX_RULES.find(
      (r) => r.ruleId === "tcs_section_206c_1h_historical",
    );
    expect(historicalRule).toBeDefined();
    expect(historicalRule?.effectiveTo).toBe("2025-03-31");

    // Current sale resolution (2026-09-01)
    const result = resolveStatutoryTaxRule({
      transactionType: "retail_sale",
      transactionDate: "2026-09-01",
    });

    expect(result.tcsApplicable).toBe(false);
    expect(result.ruleId).toBe("gst_jewellery_retail_b2c");
    expect(result.ratePct).toBe(3.0);
  });

  // ---------------------------------------------------------------------------
  // 2. Section 194Q Buyer TDS Evaluation
  // ---------------------------------------------------------------------------
  it("evaluates Section 194Q TDS on purchases exceeding ₹50L for eligible buyers (>₹10Cr turnover)", () => {
    // Case A: Eligible buyer, purchases > ₹50L with valid PAN
    const resA = resolveStatutoryTaxRule({
      transactionType: "purchase",
      transactionDate: "2026-09-01",
      buyerTurnoverPrecedingFyPaise: 15000000000, // ₹15 Cr
      sellerPurchasesCurrentFyPaise: 750000000,  // ₹75 L
      hasSellerPan: true,
    });
    expect(resA.tdsApplicable).toBe(true);
    expect(resA.tdsRatePct).toBe(0.1);

    // Case B: Eligible buyer, purchases > ₹50L without PAN (higher 5% TDS rate)
    const resB = resolveStatutoryTaxRule({
      transactionType: "purchase",
      transactionDate: "2026-09-01",
      buyerTurnoverPrecedingFyPaise: 15000000000, // ₹15 Cr
      sellerPurchasesCurrentFyPaise: 750000000,  // ₹75 L
      hasSellerPan: false,
    });
    expect(resB.tdsApplicable).toBe(true);
    expect(resB.tdsRatePct).toBe(5.0);

    // Case C: Ineligible buyer (turnover <= ₹10 Cr), no TDS
    const resC = resolveStatutoryTaxRule({
      transactionType: "purchase",
      transactionDate: "2026-09-01",
      buyerTurnoverPrecedingFyPaise: 8000000000, // ₹8 Cr
      sellerPurchasesCurrentFyPaise: 750000000,  // ₹75 L
      hasSellerPan: true,
    });
    expect(resC.tdsApplicable).toBe(false);

    // Case D: Eligible buyer, but purchases <= ₹50L, no TDS
    const resD = resolveStatutoryTaxRule({
      transactionType: "purchase",
      transactionDate: "2026-09-01",
      buyerTurnoverPrecedingFyPaise: 15000000000, // ₹15 Cr
      sellerPurchasesCurrentFyPaise: 300000000,  // ₹30 L
      hasSellerPan: true,
    });
    expect(resD.tdsApplicable).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // 3. Old Gold Supplier-Capacity Classification
  // ---------------------------------------------------------------------------
  it("classifies old gold transactions strictly by supplier capacity", () => {
    // 1. Personal customer selling old jewellery
    const personal = resolveStatutoryTaxRule({
      transactionType: "old_gold_purchase",
      transactionDate: "2026-09-01",
      supplierCapacity: "personal_customer",
    });
    expect(personal.taxType).toBe("EXEMPT");
    expect(personal.ratePct).toBe(0);
    expect(personal.statusCategory).toBe("STATUTORY RULE VERIFIED");

    // 2. Registered GST dealer selling scrap bullion
    const registered = resolveStatutoryTaxRule({
      transactionType: "old_gold_purchase",
      transactionDate: "2026-09-01",
      supplierCapacity: "registered_supplier",
    });
    expect(registered.taxType).toBe("GST");
    expect(registered.ratePct).toBe(3.0);
    expect(registered.statusCategory).toBe("STATUTORY RULE VERIFIED");

    // 3. Unregistered business supplier
    const unreg = resolveStatutoryTaxRule({
      transactionType: "old_gold_purchase",
      transactionDate: "2026-09-01",
      supplierCapacity: "unregistered_business",
    });
    expect(unreg.statusCategory).toBe("PROFESSIONAL REVIEW REQUIRED");

    // 4. Temporary Customer Custody Deposit
    const custody = resolveStatutoryTaxRule({
      transactionType: "customer_gold_received",
      transactionDate: "2026-09-01",
      supplierCapacity: "customer_custody",
    });
    expect(custody.taxType).toBe("EXEMPT");
    expect(custody.ratePct).toBe(0);
    expect(custody.statusCategory).toBe("STATUTORY RULE VERIFIED");
  });

  // ---------------------------------------------------------------------------
  // 4. Job Work Tax Base & Status Category
  // ---------------------------------------------------------------------------
  it("verifies 5% GST on Karigar job work labour charges", () => {
    const jobWork = resolveStatutoryTaxRule({
      transactionType: "job_work",
      transactionDate: "2026-09-01",
    });
    expect(jobWork.taxType).toBe("GST");
    expect(jobWork.ratePct).toBe(5.0);
    expect(jobWork.statusCategory).toBe("STATUTORY RULE VERIFIED");
  });
});
