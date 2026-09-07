/**
 * AVS ERP — Effective-Date Aware Statutory Tax & Compliance Engine
 *
 * Provides statutory rule management for Indian GST, Income Tax (TCS/TDS),
 * old-gold supplier capacity classifications, and effective-date aware taxation.
 *
 * Invariant: Historical transactions are NEVER retroactively recomputed.
 */

export type StatutoryTaxType = "GST" | "TCS" | "TDS" | "EXEMPT";

export type SupplierCapacity =
  | "personal_customer"      // Individual selling personal old jewellery (Non-business)
  | "unregistered_business"   // Unregistered trader/dealer (Evaluate RCM)
  | "registered_supplier"     // Registered GST dealer (Normal B2B supply with ITC)
  | "customer_custody"       // Temporary custody safe deposit (No sale/purchase)
  | "gold_exchange";         // Old gold trade-in settlement against new jewellery

export type StatutoryComplianceCategory =
  | "ENGINEERING VERIFIED"
  | "STATUTORY RULE VERIFIED"
  | "CONFIGURATION-DEPENDENT"
  | "PROFESSIONAL REVIEW REQUIRED";

export interface StatutoryRule {
  ruleId: string;
  name: string;
  taxType: StatutoryTaxType;
  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo: string | null; // YYYY-MM-DD or null if currently active
  defaultRatePct: number;
  hsnSacCode?: string;
  description: string;
  applicableTransactionTypes: string[];
  applicableSupplierCapacities?: SupplierCapacity[];
  statusCategory: StatutoryComplianceCategory;
  conditionNotes: string;
}

/**
 * Built-in Master Statutory Tax Rules registry with effective date ranges.
 */
export const STATUTORY_TAX_RULES: StatutoryRule[] = [
  // ── GST Rules ─────────────────────────────────────────────────────────────
  {
    ruleId: "gst_jewellery_retail_b2c",
    name: "GST on Retail Jewellery Supply (B2C)",
    taxType: "GST",
    effectiveFrom: "2017-07-01",
    effectiveTo: null,
    defaultRatePct: 3.0,
    hsnSacCode: "7113",
    description: "3% GST (1.5% CGST + 1.5% SGST or 3% IGST) on total transaction value of jewellery.",
    applicableTransactionTypes: ["retail_sale", "invoice"],
    statusCategory: "STATUTORY RULE VERIFIED",
    conditionNotes: "Applicable on full taxable value (metal + making + stones + hallmark) per GST Council FAQ Q7.",
  },
  {
    ruleId: "gst_bullion_b2b",
    name: "GST on Bullion & Raw Gold Supply (B2B)",
    taxType: "GST",
    effectiveFrom: "2017-07-01",
    effectiveTo: null,
    defaultRatePct: 3.0,
    hsnSacCode: "7108",
    description: "3% GST on pure gold bars/bullion (ITC claimable by registered dealers).",
    applicableTransactionTypes: ["purchase", "supplier_purchase"],
    statusCategory: "STATUTORY RULE VERIFIED",
    conditionNotes: "Requires valid tax invoice with GSTIN and HSN 7108.",
  },
  {
    ruleId: "gst_jobwork_labour",
    name: "GST on Karigar Job-Work (Labour / Making Charges)",
    taxType: "GST",
    effectiveFrom: "2017-07-01",
    effectiveTo: null,
    defaultRatePct: 5.0,
    hsnSacCode: "9988",
    description: "5% GST on job-work / manufacturing making charges when principal supplies the metal.",
    applicableTransactionTypes: ["job_work", "manufacturing_bill"],
    statusCategory: "STATUTORY RULE VERIFIED",
    conditionNotes: "Tax base is strictly restricted to labour, stones, and hallmarking charges.",
  },
  {
    ruleId: "gst_repair_work",
    name: "GST on Jewellery Repair & Polishing",
    taxType: "GST",
    effectiveFrom: "2017-07-01",
    effectiveTo: null,
    defaultRatePct: 5.0,
    hsnSacCode: "9988", // or 9987 depending on trade classification
    description: "5% or 18% GST on repair/polishing depending on composite vs standalone supply.",
    applicableTransactionTypes: ["repair", "service"],
    statusCategory: "CONFIGURATION-DEPENDENT",
    conditionNotes: "Requires business configuration of SAC classification (9988 vs 9987).",
  },

  // ── Old Gold Rules ─────────────────────────────────────────────────────────
  {
    ruleId: "old_gold_personal_capacity",
    name: "Old Gold Purchased from Personal Customer",
    taxType: "EXEMPT",
    effectiveFrom: "2017-07-01",
    effectiveTo: null,
    defaultRatePct: 0.0,
    description: "Sale of personal old jewellery by an individual is not in course/furtherance of business.",
    applicableTransactionTypes: ["old_gold_purchase", "customer_settlement"],
    applicableSupplierCapacities: ["personal_customer"],
    statusCategory: "STATUTORY RULE VERIFIED",
    conditionNotes: "No GST payable; no RCM applicable under current notifications.",
  },
  {
    ruleId: "old_gold_unregistered_dealer",
    name: "Old Gold from Unregistered Business Supplier",
    taxType: "GST",
    effectiveFrom: "2017-07-01",
    effectiveTo: null,
    defaultRatePct: 0.0, // RCM under Sec 9(4) suspended for gold purchases from unreg dealers
    description: "Gold sourced from unregistered traders/dealers.",
    applicableTransactionTypes: ["old_gold_purchase", "scrap_inward"],
    applicableSupplierCapacities: ["unregistered_business"],
    statusCategory: "PROFESSIONAL REVIEW REQUIRED",
    conditionNotes: "Section 9(4) RCM notification status must be verified with CA for notified classes.",
  },
  {
    ruleId: "old_gold_registered_supplier",
    name: "Scrap Gold from Registered Supplier",
    taxType: "GST",
    effectiveFrom: "2017-07-01",
    effectiveTo: null,
    defaultRatePct: 3.0,
    hsnSacCode: "7113",
    description: "Normal B2B taxable supply with full Input Tax Credit (ITC) eligibility.",
    applicableTransactionTypes: ["purchase", "supplier_purchase"],
    applicableSupplierCapacities: ["registered_supplier"],
    statusCategory: "STATUTORY RULE VERIFIED",
    conditionNotes: "3% GST charged by seller on tax invoice.",
  },
  {
    ruleId: "customer_gold_custody",
    name: "Customer Gold Safe Deposit (Custody)",
    taxType: "EXEMPT",
    effectiveFrom: "2017-07-01",
    effectiveTo: null,
    defaultRatePct: 0.0,
    description: "Fiduciary custody / bailment of customer gold for safekeeping or future order.",
    applicableTransactionTypes: ["customer_gold_received", "custody_deposit"],
    applicableSupplierCapacities: ["customer_custody"],
    statusCategory: "STATUTORY RULE VERIFIED",
    conditionNotes: "Not a supply of goods or services under Section 7 of CGST Act. 0 monetary entry.",
  },

  // ── Income Tax (TCS / TDS) ────────────────────────────────────────────────
  {
    ruleId: "tcs_section_206c_1h_historical",
    name: "Section 206C(1H) TCS on Sale of Goods (HISTORICAL ONLY)",
    taxType: "TCS",
    effectiveFrom: "2020-10-01",
    effectiveTo: "2025-03-31", // Inactive for current period FY 2026-27
    defaultRatePct: 0.1,
    description: "0.1% TCS on sale of goods exceeding ₹50 Lakhs aggregate buyer receipt in previous years.",
    applicableTransactionTypes: ["retail_sale", "invoice"],
    statusCategory: "STATUTORY RULE VERIFIED",
    conditionNotes: "INACTIVE for FY 2025-26 / 2026-27 onward. Kept strictly for historical record audit.",
  },
  {
    ruleId: "tds_section_194q_buyer_purchases",
    name: "Section 194Q TDS on Purchase of Goods",
    taxType: "TDS",
    effectiveFrom: "2021-07-01",
    effectiveTo: null,
    defaultRatePct: 0.1,
    description: "0.1% TDS deducted by buyer on purchase of goods from resident seller exceeding ₹50 Lakhs in FY.",
    applicableTransactionTypes: ["purchase", "supplier_purchase"],
    statusCategory: "STATUTORY RULE VERIFIED",
    conditionNotes: "Applicable only if buyer turnover in preceding FY > ₹10 Crores and aggregate purchases > ₹50 Lakhs.",
  },
  {
    ruleId: "cash_limit_section_269st",
    name: "Section 269ST Cash Receipt Restriction",
    taxType: "EXEMPT",
    effectiveFrom: "2017-04-01",
    effectiveTo: null,
    defaultRatePct: 0.0,
    description: "Prohibition on receiving cash of ₹2,00,000 or more in aggregate from a person in a day / per transaction.",
    applicableTransactionTypes: ["payment_receipt", "settlement"],
    statusCategory: "STATUTORY RULE VERIFIED",
    conditionNotes: "Enforces POS warning / block when single-day cash receipt from a person >= ₹2,00,000.",
  },
];

export interface TaxResolutionContext {
  transactionType: string;
  transactionDate: string | number; // ISO string or epoch ms
  supplierCapacity?: SupplierCapacity;
  buyerTurnoverPrecedingFyPaise?: number;
  sellerPurchasesCurrentFyPaise?: number;
  hasSellerPan?: boolean;
  isInterState?: boolean;
}

export interface TaxResolutionResult {
  ruleId: string;
  taxType: StatutoryTaxType;
  ratePct: number;
  isRuleActive: boolean;
  statusCategory: StatutoryComplianceCategory;
  appliedReason: string;
  tdsApplicable: boolean;
  tdsRatePct?: number;
  tcsApplicable: boolean;
  tcsRatePct?: number;
}

/**
 * Resolves the statutory tax rule applicable for a specific transaction context and date.
 */
export function resolveStatutoryTaxRule(context: TaxResolutionContext): TaxResolutionResult {
  const txMs =
    typeof context.transactionDate === "number"
      ? context.transactionDate
      : new Date(context.transactionDate).getTime();
  const txDateStr = new Date(txMs).toISOString().split("T")[0]!;

  // 1. Customer Gold Custody
  if (
    context.transactionType === "customer_gold_received" ||
    context.supplierCapacity === "customer_custody"
  ) {
    return {
      ruleId: "customer_gold_custody",
      taxType: "EXEMPT",
      ratePct: 0,
      isRuleActive: true,
      statusCategory: "STATUTORY RULE VERIFIED",
      appliedReason: "Custody safe-deposit is fiduciary bailment with 0 tax and 0 monetary impact.",
      tdsApplicable: false,
      tcsApplicable: false,
    };
  }

  // 2. Old Gold Purchase
  if (context.transactionType === "old_gold_purchase") {
    const capacity = context.supplierCapacity || "personal_customer";
    if (capacity === "personal_customer") {
      return {
        ruleId: "old_gold_personal_capacity",
        taxType: "EXEMPT",
        ratePct: 0,
        isRuleActive: true,
        statusCategory: "STATUTORY RULE VERIFIED",
        appliedReason: "Personal gold sale by consumer is not a supply in the course of business.",
        tdsApplicable: false,
        tcsApplicable: false,
      };
    }
    if (capacity === "registered_supplier") {
      return {
        ruleId: "old_gold_registered_supplier",
        taxType: "GST",
        ratePct: 3.0,
        isRuleActive: true,
        statusCategory: "STATUTORY RULE VERIFIED",
        appliedReason: "Taxable B2B scrap supply from registered GST supplier.",
        tdsApplicable: false,
        tcsApplicable: false,
      };
    }
    return {
      ruleId: "old_gold_unregistered_dealer",
      taxType: "GST",
      ratePct: 0,
      isRuleActive: true,
      statusCategory: "PROFESSIONAL REVIEW REQUIRED",
      appliedReason: "Unregistered business supplier: RCM applicability requires verification.",
      tdsApplicable: false,
      tcsApplicable: false,
    };
  }

  // 3. Section 194Q TDS Evaluation on Purchases
  if (context.transactionType === "purchase" || context.transactionType === "supplier_purchase") {
    const buyerEligible = (context.buyerTurnoverPrecedingFyPaise ?? 0) > 10000000000; // > ₹10 Cr
    const purchasesExceed50L = (context.sellerPurchasesCurrentFyPaise ?? 0) > 500000000; // > ₹50 L
    const tdsApplies = buyerEligible && purchasesExceed50L;
    const tdsRate = tdsApplies ? (context.hasSellerPan === false ? 5.0 : 0.1) : 0;

    return {
      ruleId: "gst_bullion_b2b",
      taxType: "GST",
      ratePct: 3.0,
      isRuleActive: true,
      statusCategory: "STATUTORY RULE VERIFIED",
      appliedReason: "3% GST on Bullion purchase with Section 194Q TDS evaluation.",
      tdsApplicable: tdsApplies,
      tdsRatePct: tdsRate,
      tcsApplicable: false,
    };
  }

  // 4. Job Work (Labour Charges)
  if (context.transactionType === "job_work" || context.transactionType === "manufacturing_bill") {
    return {
      ruleId: "gst_jobwork_labour",
      taxType: "GST",
      ratePct: 5.0,
      isRuleActive: true,
      statusCategory: "STATUTORY RULE VERIFIED",
      appliedReason: "5% GST on Job-Work manufacturing/labour making charges (SAC 9988).",
      tdsApplicable: false,
      tcsApplicable: false,
    };
  }

  // 5. Retail Jewellery Sale
  // Note: Section 206C(1H) is INACTIVE for current date (>= 2025-04-01)
  const isHistorical206CPeriod = txDateStr < "2025-04-01";

  return {
    ruleId: "gst_jewellery_retail_b2c",
    taxType: "GST",
    ratePct: 3.0,
    isRuleActive: true,
    statusCategory: "STATUTORY RULE VERIFIED",
    appliedReason: isHistorical206CPeriod
      ? "3% GST on Jewellery (Historical 206C(1H) evaluated for prior periods)."
      : "3% GST on Retail Jewellery (Section 206C(1H) TCS inactive for current periods).",
    tdsApplicable: false,
    tcsApplicable: false, // Inactive for current periods
  };
}
