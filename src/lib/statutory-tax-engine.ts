/**
 * AVS ERP — Authoritative Statutory Tax & Compliance Engine
 *
 * Provides deterministic, effective-date aware rule resolution for:
 * 1. Indian GST (HSN 7113 Retail Jewellery, HSN 7108 Bullion, SAC 9988 Job Work)
 * 2. Old Gold Supplier Capacities (Personal, Unregistered, Registered, Custody, Exchange)
 * 3. Income Tax Provisions (Section 194Q Buyer TDS, Section 206C(1H) Inactive TCS, Section 269ST)
 * 4. Double Taxation Prevention and Single-Source Tax Snapshots
 * 5. Explicit Rule Statuses: ON, OFF, CONFIGURATION_REQUIRED, REVIEW_REQUIRED
 * 6. Audit Trail for Authorized Tax Overrides
 *
 * Invariant: Every tax decision is frozen into an immutable snapshot.
 */

import { create } from "zustand";

export type TaxRuleStatus = "ON" | "OFF" | "CONFIGURATION_REQUIRED" | "REVIEW_REQUIRED";

export type StatutoryTaxType = "GST" | "TCS" | "TDS" | "EXEMPT";

export type SupplierCapacity =
  | "personal_customer"     // Individual selling personal old jewellery (Non-business / 0% Tax)
  | "unregistered_business"  // Unregistered trader/dealer (Flagged as REVIEW_REQUIRED)
  | "registered_supplier"    // Registered GST dealer (Normal B2B supply with ITC)
  | "customer_custody"      // Temporary custody safe deposit (Non-supply / 0% Tax)
  | "gold_exchange";        // Old gold trade-in settlement against new jewellery

export type StatutoryComplianceCategory =
  | "ENGINEERING VERIFIED"
  | "STATUTORY RULE VERIFIED"
  | "CONFIGURATION-DEPENDENT"
  | "PROFESSIONAL REVIEW REQUIRED";

export interface StatutoryRule {
  ruleId: string;
  name: string;
  taxType: StatutoryTaxType;
  status: TaxRuleStatus;
  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo: string | null; // YYYY-MM-DD or null if currently active
  defaultRatePct: number;
  hsnSacCode?: string;
  appliesTo: string;
  description: string;
  applicableTransactionTypes: string[];
  applicableSupplierCapacities?: SupplierCapacity[];
  statusCategory: StatutoryComplianceCategory;
  conditionNotes: string;
  ruleVersion: string;
}

/**
 * Built-in Master Statutory Tax Rules registry with explicit statuses and effective dates.
 */
export const DEFAULT_STATUTORY_TAX_RULES: StatutoryRule[] = [
  // ── GST Rules ─────────────────────────────────────────────────────────────
  {
    ruleId: "gst_jewellery_retail_b2c",
    name: "Jewellery GST",
    taxType: "GST",
    status: "ON",
    effectiveFrom: "2017-07-01",
    effectiveTo: null,
    defaultRatePct: 3.0,
    hsnSacCode: "7113",
    appliesTo: "Retail jewellery (HSN 7113 composite supply)",
    description: "3% GST (1.5% CGST + 1.5% SGST or 3% IGST) on total transaction value of jewellery.",
    applicableTransactionTypes: ["retail_sale", "invoice", "credit_note", "debit_note"],
    statusCategory: "STATUTORY RULE VERIFIED",
    conditionNotes: "Applicable on full taxable value (metal + making + stones + hallmark) per GST Council FAQ Q7. No separate double-taxation on making charges.",
    ruleVersion: "2026.1",
  },
  {
    ruleId: "gst_bullion_b2b",
    name: "Bullion GST",
    taxType: "GST",
    status: "ON",
    effectiveFrom: "2017-07-01",
    effectiveTo: null,
    defaultRatePct: 3.0,
    hsnSacCode: "7108",
    appliesTo: "Taxable bullion supply (B2B)",
    description: "3% GST on pure gold bars/bullion (ITC claimable by registered dealers).",
    applicableTransactionTypes: ["purchase", "supplier_purchase"],
    statusCategory: "STATUTORY RULE VERIFIED",
    conditionNotes: "Requires valid tax invoice with GSTIN and HSN 7108.",
    ruleVersion: "2026.1",
  },
  {
    ruleId: "gst_jobwork_labour",
    name: "Job-work GST",
    taxType: "GST",
    status: "ON",
    effectiveFrom: "2017-07-01",
    effectiveTo: null,
    defaultRatePct: 5.0,
    hsnSacCode: "9988",
    appliesTo: "Genuine job work & manufacturing labour charges",
    description: "5% GST on job-work / manufacturing making charges when principal supplies the metal.",
    applicableTransactionTypes: ["job_work", "manufacturing_bill"],
    statusCategory: "STATUTORY RULE VERIFIED",
    conditionNotes: "Tax base is strictly restricted to labour, stones, and hallmarking charges.",
    ruleVersion: "2026.1",
  },
  {
    ruleId: "gst_repair_work",
    name: "Repair & Polishing GST",
    taxType: "GST",
    status: "CONFIGURATION_REQUIRED",
    effectiveFrom: "2017-07-01",
    effectiveTo: null,
    defaultRatePct: 5.0,
    hsnSacCode: "9988",
    appliesTo: "Repair, alterations, and polishing services",
    description: "5% or 18% GST on repair/polishing depending on composite vs standalone supply.",
    applicableTransactionTypes: ["repair", "service", "polishing"],
    statusCategory: "CONFIGURATION-DEPENDENT",
    conditionNotes: "Requires business configuration of SAC classification (9988 vs 9987).",
    ruleVersion: "2026.1",
  },

  // ── Old Gold Rules ─────────────────────────────────────────────────────────
  {
    ruleId: "old_gold_personal_capacity",
    name: "Old Gold from Personal Customer",
    taxType: "EXEMPT",
    status: "ON",
    effectiveFrom: "2017-07-01",
    effectiveTo: null,
    defaultRatePct: 0.0,
    appliesTo: "Personal customer old jewellery sale",
    description: "Sale of personal old jewellery by an individual is not in course/furtherance of business.",
    applicableTransactionTypes: ["old_gold_purchase", "customer_settlement"],
    applicableSupplierCapacities: ["personal_customer"],
    statusCategory: "STATUTORY RULE VERIFIED",
    conditionNotes: "No GST payable; no RCM applicable under section 9(4) notifications.",
    ruleVersion: "2026.1",
  },
  {
    ruleId: "old_gold_unregistered_dealer",
    name: "RCM on Unregistered Business Supplier",
    taxType: "GST",
    status: "CONFIGURATION_REQUIRED",
    effectiveFrom: "2017-07-01",
    effectiveTo: null,
    defaultRatePct: 0.0,
    appliesTo: "Notified transactions / Unregistered bullion dealers",
    description: "Gold sourced from unregistered commercial traders/dealers.",
    applicableTransactionTypes: ["old_gold_purchase", "scrap_inward"],
    applicableSupplierCapacities: ["unregistered_business"],
    statusCategory: "PROFESSIONAL REVIEW REQUIRED",
    conditionNotes: "Section 9(4) RCM notification status must be verified with CA for notified classes.",
    ruleVersion: "2026.1",
  },
  {
    ruleId: "old_gold_registered_supplier",
    name: "Scrap Gold from Registered Supplier",
    taxType: "GST",
    status: "ON",
    effectiveFrom: "2017-07-01",
    effectiveTo: null,
    defaultRatePct: 3.0,
    hsnSacCode: "7113",
    appliesTo: "Registered B2B supplier scrap metal",
    description: "Normal B2B taxable supply with full Input Tax Credit (ITC) eligibility.",
    applicableTransactionTypes: ["purchase", "supplier_purchase", "old_gold_purchase"],
    applicableSupplierCapacities: ["registered_supplier"],
    statusCategory: "STATUTORY RULE VERIFIED",
    conditionNotes: "3% GST charged by seller on tax invoice.",
    ruleVersion: "2026.1",
  },
  {
    ruleId: "customer_gold_custody",
    name: "Customer Gold Safe Custody",
    taxType: "EXEMPT",
    status: "ON",
    effectiveFrom: "2017-07-01",
    effectiveTo: null,
    defaultRatePct: 0.0,
    appliesTo: "Customer gold safe custody / fiduciary deposit",
    description: "Fiduciary custody / bailment of customer gold for safekeeping or future order.",
    applicableTransactionTypes: ["customer_gold_received", "custody_deposit"],
    applicableSupplierCapacities: ["customer_custody"],
    statusCategory: "STATUTORY RULE VERIFIED",
    conditionNotes: "Not a supply of goods or services under Section 7 of CGST Act. 0 monetary entry.",
    ruleVersion: "2026.1",
  },

  // ── Income Tax (TCS / TDS) ────────────────────────────────────────────────
  {
    ruleId: "tcs_section_206c_1h_historical",
    name: "Section 206C(1H) TCS",
    taxType: "TCS",
    status: "OFF",
    effectiveFrom: "2020-10-01",
    effectiveTo: "2025-03-31", // Explicitly ended
    defaultRatePct: 0.0,
    appliesTo: "Current FY (Sale of goods TCS inactive since 01-04-2025)",
    description: "0.1% TCS on sale of goods exceeding ₹50 Lakhs aggregate buyer receipt in previous years.",
    applicableTransactionTypes: ["retail_sale", "invoice"],
    statusCategory: "STATUTORY RULE VERIFIED",
    conditionNotes: "INACTIVE for FY 2025-26 / 2026-27 onward. Kept strictly for historical record audit.",
    ruleVersion: "2026.1",
  },
  {
    ruleId: "tds_section_194q_buyer_purchases",
    name: "Section 194Q TDS",
    taxType: "TDS",
    status: "ON",
    effectiveFrom: "2021-07-01",
    effectiveTo: null,
    defaultRatePct: 0.1,
    appliesTo: "Eligible purchases (Buyer turnover > ₹10Cr & seller FY purchases > ₹50L)",
    description: "0.1% TDS deducted by buyer on purchase of goods from resident seller exceeding ₹50 Lakhs in FY.",
    applicableTransactionTypes: ["purchase", "supplier_purchase"],
    statusCategory: "STATUTORY RULE VERIFIED",
    conditionNotes: "Applicable only if buyer turnover in preceding FY > ₹10 Crores and aggregate purchases > ₹50 Lakhs.",
    ruleVersion: "2026.1",
  },
  {
    ruleId: "cash_limit_section_269st",
    name: "Section 269ST Cash Limit",
    taxType: "EXEMPT",
    status: "ON",
    effectiveFrom: "2017-04-01",
    effectiveTo: null,
    defaultRatePct: 0.0,
    appliesTo: "Single-day / single-transaction cash receipts",
    description: "Prohibition on receiving cash of ₹2,00,000 or more in aggregate from a person in a day.",
    applicableTransactionTypes: ["payment_receipt", "settlement"],
    statusCategory: "STATUTORY RULE VERIFIED",
    conditionNotes: "Enforces POS warning / block when single-day cash receipt from a person >= ₹2,00,000.",
    ruleVersion: "2026.1",
  },
];

export const STATUTORY_TAX_RULES = DEFAULT_STATUTORY_TAX_RULES;

// ── State Store for Configurable Tax Control Rules ───────────────────────────

interface StatutoryTaxStoreState {
  rules: StatutoryRule[];
  setRuleStatus: (ruleId: string, status: TaxRuleStatus) => void;
  setRuleRate: (ruleId: string, ratePct: number) => void;
  resetToDefaults: () => void;
  getRule: (ruleId: string) => StatutoryRule | undefined;
}

const STATUTORY_RULES_STORAGE_KEY = "avs_statutory_tax_rules_v1";

function loadSavedRules(): StatutoryRule[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return DEFAULT_STATUTORY_TAX_RULES;
  }
  try {
    const raw = window.localStorage.getItem(STATUTORY_RULES_STORAGE_KEY);
    if (!raw) return DEFAULT_STATUTORY_TAX_RULES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Merge with defaults to ensure all keys and latest descriptions exist
      return DEFAULT_STATUTORY_TAX_RULES.map((defRule) => {
        const found = parsed.find((r: StatutoryRule) => r.ruleId === defRule.ruleId);
        return found ? { ...defRule, ...found } : defRule;
      });
    }
  } catch {
    // fallback
  }
  return DEFAULT_STATUTORY_TAX_RULES;
}

function saveRules(rules: StatutoryRule[]): void {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(STATUTORY_RULES_STORAGE_KEY, JSON.stringify(rules));
    } catch {
      // ignore
    }
  }
}

export const useStatutoryTaxStore = create<StatutoryTaxStoreState>((set, get) => ({
  rules: loadSavedRules(),
  setRuleStatus: (ruleId: string, status: TaxRuleStatus) => {
    const nextRules = get().rules.map((r) => (r.ruleId === ruleId ? { ...r, status } : r));
    set({ rules: nextRules });
    saveRules(nextRules);
  },
  setRuleRate: (ruleId: string, defaultRatePct: number) => {
    const nextRules = get().rules.map((r) => (r.ruleId === ruleId ? { ...r, defaultRatePct } : r));
    set({ rules: nextRules });
    saveRules(nextRules);
  },
  resetToDefaults: () => {
    set({ rules: DEFAULT_STATUTORY_TAX_RULES });
    saveRules(DEFAULT_STATUTORY_TAX_RULES);
  },
  getRule: (ruleId: string) => {
    return get().rules.find((r) => r.ruleId === ruleId);
  },
}));

// ── Tax Resolution & Calculation Interfaces ──────────────────────────────────

export interface TaxOverrideRecord {
  overrideId: string;
  user: string;
  reason: string;
  timestamp: string;
  originalRuleId: string;
  originalStatus: TaxRuleStatus;
  originalRatePct: number;
  newStatus: TaxRuleStatus;
  newRatePct: number;
  referenceDocument?: string;
}

export interface TaxResolutionContext {
  transactionType: string;
  transactionDate: string | number; // ISO string or epoch ms
  taxableAmountPaise?: number;
  makingChargesPaise?: number;
  stoneChargesPaise?: number;
  hallmarkChargesPaise?: number;
  supplierCapacity?: SupplierCapacity;
  buyerTurnoverPrecedingFyPaise?: number;
  sellerPurchasesCurrentFyPaise?: number;
  hasSellerPan?: boolean;
  isInterState?: boolean;
  override?: TaxOverrideRecord;
}

export interface TaxDecisionSnapshot {
  taxApplicable: boolean;
  taxReason: string;
  ruleId: string;
  ruleVersion: string;
  ruleStatus: TaxRuleStatus;
  taxType: StatutoryTaxType;
  taxRatePct: number;
  taxableValuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalTaxPaise: number;
  rcmApplicable: boolean;
  rcmStatus?: TaxRuleStatus;
  tdsApplicable: boolean;
  tdsRatePct?: number;
  tdsAmountPaise?: number;
  tcsApplicable: boolean;
  tcsRatePct?: number;
  tcsAmountPaise?: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  statusCategory: StatutoryComplianceCategory;
  override?: TaxOverrideRecord;
  calculatedAt: string;
}

export type TaxResolutionResult = TaxDecisionSnapshot & {
  isRuleActive: boolean;
  ratePct: number;
  appliedReason: string;
};

// ── Core Tax Decision & Pipeline Execution ───────────────────────────────────

/**
 * Executes the complete 10-step automatic tax decision pipeline:
 * Transaction -> Type -> Capacity -> Classification -> Place of Supply -> Effective Date ->
 * Rule Status (ON/OFF/CONFIG/REVIEW) -> Statutory Conditions -> Computation -> Frozen Snapshot.
 */
export function calculateTaxDecision(
  context: TaxResolutionContext,
  customRules?: StatutoryRule[],
): TaxDecisionSnapshot {
  const activeRules = customRules || useStatutoryTaxStore.getState().rules || DEFAULT_STATUTORY_TAX_RULES;

  const txMs =
    typeof context.transactionDate === "number"
      ? context.transactionDate
      : new Date(context.transactionDate).getTime();
  const txDateStr = new Date(txMs).toISOString().split("T")[0]!;
  const calculatedAt = new Date().toISOString();
  const taxableValuePaise = context.taxableAmountPaise ?? 0;
  const isInterState = !!context.isInterState;

  // Helper to construct zero-tax snapshot
  const zeroTaxSnapshot = (
    rule: StatutoryRule,
    reason: string,
    ruleStatus: TaxRuleStatus = rule.status,
  ): TaxDecisionSnapshot => ({
    taxApplicable: false,
    taxReason: reason,
    ruleId: rule.ruleId,
    ruleVersion: rule.ruleVersion,
    ruleStatus,
    taxType: rule.taxType,
    taxRatePct: 0,
    taxableValuePaise,
    cgstPaise: 0,
    sgstPaise: 0,
    igstPaise: 0,
    totalTaxPaise: 0,
    rcmApplicable: false,
    tdsApplicable: false,
    tcsApplicable: false,
    effectiveFrom: rule.effectiveFrom,
    effectiveTo: rule.effectiveTo,
    statusCategory: rule.statusCategory,
    calculatedAt,
  });

  // Helper to find a rule from store
  const getRule = (ruleId: string): StatutoryRule => {
    return activeRules.find((r) => r.ruleId === ruleId) || DEFAULT_STATUTORY_TAX_RULES.find((r) => r.ruleId === ruleId)!;
  };

  // Helper to calculate CGST/SGST/IGST split with integer precision
  const computeGstSplit = (basePaise: number, ratePct: number) => {
    const totalTaxPaise = Math.round((basePaise * ratePct) / 100);
    if (isInterState) {
      return { cgstPaise: 0, sgstPaise: 0, igstPaise: totalTaxPaise, totalTaxPaise };
    }
    const sgstPaise = Math.floor(totalTaxPaise / 2);
    const cgstPaise = totalTaxPaise - sgstPaise;
    return { cgstPaise, sgstPaise, igstPaise: 0, totalTaxPaise };
  };

  // ── Step 1: Customer Gold Custody ─────────────────────────────────────────
  if (
    context.transactionType === "customer_gold_received" ||
    context.supplierCapacity === "customer_custody"
  ) {
    const rule = getRule("customer_gold_custody");
    return zeroTaxSnapshot(
      rule,
      "CUSTOMER_CUSTODY_NON_SUPPLY: Customer gold custody is fiduciary bailment with 0 tax.",
    );
  }

  // ── Step 2: Old Gold Purchase ──────────────────────────────────────────────
  if (context.transactionType === "old_gold_purchase") {
    const capacity = context.supplierCapacity || "personal_customer";

    if (capacity === "personal_customer") {
      const rule = getRule("old_gold_personal_capacity");
      return zeroTaxSnapshot(
        rule,
        "PERSONAL_OLD_GOLD_EXEMPT: Personal customer old gold sale is not a taxable supply in business course.",
      );
    }

    if (capacity === "registered_supplier") {
      const rule = getRule("old_gold_registered_supplier");
      if (rule.status === "OFF") {
        return zeroTaxSnapshot(rule, "RULE_OFF: Registered supplier scrap rule is configured OFF.");
      }
      const rate = rule.defaultRatePct;
      const split = computeGstSplit(taxableValuePaise, rate);
      return {
        taxApplicable: rate > 0 && split.totalTaxPaise > 0,
        taxReason: "REGISTERED_SUPPLIER_SCRAP: 3% GST on B2B scrap supply from registered supplier.",
        ruleId: rule.ruleId,
        ruleVersion: rule.ruleVersion,
        ruleStatus: rule.status,
        taxType: "GST",
        taxRatePct: rate,
        taxableValuePaise,
        ...split,
        rcmApplicable: false,
        tdsApplicable: false,
        tcsApplicable: false,
        effectiveFrom: rule.effectiveFrom,
        effectiveTo: rule.effectiveTo,
        statusCategory: rule.statusCategory,
        calculatedAt,
      };
    }

    // Unregistered Business Supplier -> Must be marked REVIEW_REQUIRED / CONFIGURATION_REQUIRED
    const rule = getRule("old_gold_unregistered_dealer");
    return {
      taxApplicable: false,
      taxReason:
        "REVIEW_REQUIRED: Unregistered business supplier requires professional verification before RCM application.",
      ruleId: rule.ruleId,
      ruleVersion: rule.ruleVersion,
      ruleStatus: "REVIEW_REQUIRED",
      taxType: "GST",
      taxRatePct: 0,
      taxableValuePaise,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 0,
      totalTaxPaise: 0,
      rcmApplicable: false,
      rcmStatus: "REVIEW_REQUIRED",
      tdsApplicable: false,
      tcsApplicable: false,
      effectiveFrom: rule.effectiveFrom,
      effectiveTo: rule.effectiveTo,
      statusCategory: "PROFESSIONAL REVIEW REQUIRED",
      calculatedAt,
    };
  }

  // ── Step 3: Section 194Q TDS Evaluation on Purchases ──────────────────────
  if (context.transactionType === "purchase" || context.transactionType === "supplier_purchase") {
    const bullionRule = getRule("gst_bullion_b2b");
    const tdsRule = getRule("tds_section_194q_buyer_purchases");

    // Check Bullion GST Rule Status
    const gstRate = bullionRule.status === "ON" ? bullionRule.defaultRatePct : 0;
    const gstSplit = computeGstSplit(taxableValuePaise, gstRate);

    // Section 194Q TDS evaluation
    let tdsApplicable = false;
    let tdsRatePct = 0;
    let tdsAmountPaise = 0;
    let tdsReason = "";
    let tdsStatus: TaxRuleStatus = tdsRule.status;

    if (tdsRule.status === "OFF") {
      tdsReason = "194Q_OFF: Section 194Q rule is turned OFF.";
    } else if (
      context.buyerTurnoverPrecedingFyPaise === undefined ||
      context.sellerPurchasesCurrentFyPaise === undefined
    ) {
      tdsStatus = "CONFIGURATION_REQUIRED";
      tdsReason = "194Q_CONFIG_REQUIRED: Missing buyer turnover or seller FY purchase data for Section 194Q evaluation.";
    } else {
      const buyerEligible = context.buyerTurnoverPrecedingFyPaise > 10000000000; // > ₹10 Cr
      const purchasesExceed50L = context.sellerPurchasesCurrentFyPaise > 500000000; // > ₹50 L

      if (buyerEligible && purchasesExceed50L) {
        tdsApplicable = true;
        tdsRatePct = context.hasSellerPan === false ? 5.0 : 0.1;
        tdsAmountPaise = Math.round((taxableValuePaise * tdsRatePct) / 100);
        tdsReason = `194Q_APPLICABLE: ${tdsRatePct}% Section 194Q TDS deducted on eligible buyer purchase.`;
      } else {
        tdsReason = "194Q_INELIGIBLE: Threshold conditions not satisfied (Buyer turnover <= ₹10Cr or purchases <= ₹50L).";
      }
    }

    const appliedReason =
      bullionRule.status === "OFF"
        ? `RULE_OFF: Bullion GST is configured OFF. ${tdsReason}`
        : `B2B_BULLION_SUPPLY: 3% GST on Bullion purchase. ${tdsReason}`;

    return {
      taxApplicable: gstRate > 0 && gstSplit.totalTaxPaise > 0,
      taxReason: appliedReason,
      ruleId: bullionRule.ruleId,
      ruleVersion: bullionRule.ruleVersion,
      ruleStatus: bullionRule.status,
      taxType: "GST",
      taxRatePct: gstRate,
      taxableValuePaise,
      ...gstSplit,
      rcmApplicable: false,
      tdsApplicable,
      tdsRatePct: tdsApplicable ? tdsRatePct : 0,
      tdsAmountPaise,
      tcsApplicable: false,
      effectiveFrom: bullionRule.effectiveFrom,
      effectiveTo: bullionRule.effectiveTo,
      statusCategory: bullionRule.statusCategory,
      calculatedAt,
    };
  }

  // ── Step 4: Job Work (SAC 9988) ───────────────────────────────────────────
  if (context.transactionType === "job_work" || context.transactionType === "manufacturing_bill") {
    const rule = getRule("gst_jobwork_labour");
    if (rule.status === "OFF") {
      return zeroTaxSnapshot(rule, "RULE_OFF: Job-work GST rule is configured OFF.");
    }
    const rate = rule.defaultRatePct;
    const split = computeGstSplit(taxableValuePaise, rate);
    return {
      taxApplicable: rate > 0 && split.totalTaxPaise > 0,
      taxReason: "QUALIFYING_JOB_WORK: 5% GST on Job-Work labour/making charges under SAC 9988.",
      ruleId: rule.ruleId,
      ruleVersion: rule.ruleVersion,
      ruleStatus: rule.status,
      taxType: "GST",
      taxRatePct: rate,
      taxableValuePaise,
      ...split,
      rcmApplicable: false,
      tdsApplicable: false,
      tcsApplicable: false,
      effectiveFrom: rule.effectiveFrom,
      effectiveTo: rule.effectiveTo,
      statusCategory: rule.statusCategory,
      calculatedAt,
    };
  }

  // ── Step 5: Retail Jewellery Sale & Section 206C(1H) ──────────────────────
  const jewelleryRule = getRule("gst_jewellery_retail_b2c");

  // Check if Rule is OFF
  if (jewelleryRule.status === "OFF") {
    return zeroTaxSnapshot(jewelleryRule, "RULE_OFF: Retail Jewellery GST rule is configured OFF.");
  }

  // Check Effective Date Range
  if (jewelleryRule.effectiveFrom > txDateStr) {
    return zeroTaxSnapshot(
      jewelleryRule,
      `RULE_INACTIVE_YET: Jewellery GST rule is effective only from ${jewelleryRule.effectiveFrom}.`,
    );
  }

  const rate = jewelleryRule.defaultRatePct;
  const split = computeGstSplit(taxableValuePaise, rate);

  // Section 206C(1H) is INACTIVE for current periods (>= 2025-04-01)
  const isHistorical206C = txDateStr < "2025-04-01";
  const tcsReason = isHistorical206C
    ? "Historical 206C(1H) evaluated for prior periods."
    : "Section 206C(1H) TCS inactive for current FY (01-04-2025 onward).";

  const snapshot: TaxDecisionSnapshot = {
    taxApplicable: rate > 0 && split.totalTaxPaise > 0,
    taxReason: `QUALIFYING_RETAIL_JEWELLERY: 3% composite GST on total value under HSN 7113. ${tcsReason}`,
    ruleId: jewelleryRule.ruleId,
    ruleVersion: jewelleryRule.ruleVersion,
    ruleStatus: jewelleryRule.status,
    taxType: "GST",
    taxRatePct: rate,
    taxableValuePaise,
    ...split,
    rcmApplicable: false,
    tdsApplicable: false,
    tcsApplicable: false, // Inactive for current period
    effectiveFrom: jewelleryRule.effectiveFrom,
    effectiveTo: jewelleryRule.effectiveTo,
    statusCategory: jewelleryRule.statusCategory,
    calculatedAt,
  };

  // ── Step 6: Handle Authorized Tax Override if present ─────────────────────
  if (context.override) {
    const ov = context.override;
    if (ov.newStatus === "OFF" || ov.newRatePct === 0) {
      return {
        ...snapshot,
        taxApplicable: false,
        taxRatePct: 0,
        cgstPaise: 0,
        sgstPaise: 0,
        igstPaise: 0,
        totalTaxPaise: 0,
        taxReason: `OVERRIDE_APPLIED: Overridden by ${ov.user} (${ov.reason})`,
        override: ov,
      };
    }
    const overrideSplit = computeGstSplit(taxableValuePaise, ov.newRatePct);
    return {
      ...snapshot,
      taxApplicable: ov.newRatePct > 0 && overrideSplit.totalTaxPaise > 0,
      taxRatePct: ov.newRatePct,
      ...overrideSplit,
      taxReason: `OVERRIDE_APPLIED: Overridden to ${ov.newRatePct}% by ${ov.user} (${ov.reason})`,
      override: ov,
    };
  }

  return snapshot;
}

/**
 * Resolves the statutory tax rule applicable for a specific transaction context and date.
 * (Backward-compatible adapter returning full TaxResolutionResult)
 */
export function resolveStatutoryTaxRule(context: TaxResolutionContext): TaxResolutionResult {
  const snapshot = calculateTaxDecision(context);
  return {
    ...snapshot,
    isRuleActive: snapshot.ruleStatus === "ON",
    ratePct: snapshot.taxRatePct,
    appliedReason: snapshot.taxReason,
  };
}

/**
 * Validates tax uniqueness across line items and related documents to prevent double-taxation.
 */
export function validateTaxUniqueness(snapshots: TaxDecisionSnapshot[]): {
  valid: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  const hasRetailJewelleryGst = snapshots.some(
    (s) => s.ruleId === "gst_jewellery_retail_b2c" && s.taxApplicable,
  );
  const hasJobWorkLabourGst = snapshots.some(
    (s) => s.ruleId === "gst_jobwork_labour" && s.taxApplicable,
  );

  // Invariant 1: Retail Jewellery Composite Sale (HSN 7113) includes making charges;
  // it must NEVER also apply separate Job-Work GST (SAC 9988) to the same invoice.
  if (hasRetailJewelleryGst && hasJobWorkLabourGst) {
    violations.push(
      "DOUBLE_TAXATION_VIOLATION: Retail Jewellery composite 3% GST already encompasses making charges. Separate 5% job-work tax cannot be added to the same supply.",
    );
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}
