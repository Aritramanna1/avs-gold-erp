/**
 * AVS-27 / AVS-30 TAX-P0a — firm tax profile types.
 *
 * Rates and modes come from CA-approved firm profiles (Researchy AVS-27).
 * Do not invent rates in call sites; read them from TaxProfile after the CA gate.
 * Default COMPOSITE_3PCT / FAQ Q7 values are draft-only until ca_approved_at is set.
 */

export type JewellerySaleMode = "COMPOSITE_3PCT";

export type OldGoldValuationMode = "FULL_TV" | "MARGIN_32_5" | "MANUAL_CA";

/**
 * Firm tax profile (Settings-editable). Matches Researchy AVS-27 §4.1 sketch
 * plus CA approval fields required by IMPL AVS-30.
 */
export type TaxProfile = {
  firmId: string;
  /** FAQ Q7 default mode — GST Council Gems & Jewellery sectoral FAQ. */
  jewellerySaleMode: JewellerySaleMode;
  /**
   * Percent rate applied when jewellerySaleMode === COMPOSITE_3PCT.
   * Draft default 3 comes from FAQ Q7; production use requires ca_approved_at.
   */
  jewelleryCompositeRatePct: number;
  jobWorkSac: "9988";
  jobWorkRatePct: number;
  jewelleryHsn: "7113";
  /** Place-of-supply / AATO policy — set by CA, not invented here. */
  eInvoiceRequired: boolean;
  tdsGoodsBuyer: boolean;
  /** Classic 194Q-class rate; section codes are config — verify each FY with CA. */
  tdsRatePct: number;
  tdsVendorThresholdInr: number;
  oldGoldMode: OldGoldValuationMode;
  /** e.g. gst-council-faq-gems-2017+FY2026 — set with CA pack, not invented per invoice. */
  rulePackVersion: string;
  /**
   * Firm GSTIN placeholder only in drafts — never hardcode a real number here.
   * Real GSTIN lives on organization / branch settings.
   */
  gstinPlaceholder?: string;
  caApprovedAt: string | null;
  caApprovedBy: string | null;
  updatedAt?: string;
  updatedBy?: string | null;
};

/** Persisted on invoices (TAX-P0a acceptance). */
export type InvoiceTaxAuditFields = {
  taxBreakdownJson: TaxBreakdown;
  ruleId: string;
  rulePackVersion: string;
};

export type TaxBreakdown = {
  goldValueInr: number;
  makingInr: number;
  stoneInr: number;
  otherTaxableInr: number;
  taxableValue: number;
  gstRatePct: number;
  gstAmount: number;
  /** Split helpers — place-of-supply wiring is a later PR. */
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  jewellerySaleMode: JewellerySaleMode;
  hsn: string;
  inputs: {
    goldValueInr: number;
    makingInr: number;
    stoneInr: number;
    otherTaxableInr: number;
  };
  ruleId: string;
  rulePackVersion: string;
};

export type TaxApplyBlocked = {
  status: "blocked";
  reason: "AWAITING_CA_APPROVAL";
  uiLabel: "Awaiting CA approval";
  profileFirmId: string;
};

export type TaxApplyOk = {
  status: "ok";
  taxableValue: number;
  gstRatePct: number;
  gstAmount: number;
  ruleId: string;
  rulePackVersion: string;
  breakdown: TaxBreakdown;
};

export type TaxApplyResult = TaxApplyBlocked | TaxApplyOk;

export const GST_COUNCIL_FAQ_GEMS_Q7 = "GST_COUNCIL_FAQ_GEMS_Q7" as const;

/** Draft rule-pack label — CA replaces / confirms before production enable. */
export const DRAFT_RULE_PACK_VERSION = "gst-council-faq-gems-2017+FY2026-DRAFT" as const;
