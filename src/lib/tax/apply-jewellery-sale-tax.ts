/**
 * Jewellery sale tax apply — COMPOSITE_3PCT path (GST Council FAQ Gems Q7).
 * Making may display separately; tax is on total taxable jewellery supply
 * unless a CA-approved profile overrides (no silent 18% making GST).
 *
 * Production path refuses until ca_approved_at is set.
 */

import { assertTaxRatesMayApply } from "./ca-approval-gate";
import {
  GST_COUNCIL_FAQ_GEMS_Q7,
  type TaxApplyResult,
  type TaxBreakdown,
  type TaxProfile,
} from "./types";

export type JewellerySaleTaxInput = {
  goldValueInr: number;
  makingInr: number;
  stoneInr: number;
  otherTaxableInr: number;
  profile: TaxProfile;
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function sumTaxable(input: JewellerySaleTaxInput): number {
  return (
    input.goldValueInr +
    input.makingInr +
    input.stoneInr +
    input.otherTaxableInr
  );
}

function buildBreakdown(
  input: JewellerySaleTaxInput,
  taxableValue: number,
  gstRatePct: number,
  gstAmount: number,
): TaxBreakdown {
  return {
    goldValueInr: input.goldValueInr,
    makingInr: input.makingInr,
    stoneInr: input.stoneInr,
    otherTaxableInr: input.otherTaxableInr,
    taxableValue,
    gstRatePct,
    gstAmount,
    jewellerySaleMode: input.profile.jewellerySaleMode,
    hsn: input.profile.jewelleryHsn,
    inputs: {
      goldValueInr: input.goldValueInr,
      makingInr: input.makingInr,
      stoneInr: input.stoneInr,
      otherTaxableInr: input.otherTaxableInr,
    },
    ruleId: GST_COUNCIL_FAQ_GEMS_Q7,
    rulePackVersion: input.profile.rulePackVersion,
  };
}

/**
 * Production apply — blocked without CA approval.
 * Rate comes from profile.jewelleryCompositeRatePct (Settings / CA), not invented here.
 */
export function applyJewellerySaleTax(input: JewellerySaleTaxInput): TaxApplyResult {
  const gate = assertTaxRatesMayApply(input.profile);
  if (!gate.ok) {
    return {
      status: "blocked",
      reason: gate.reason,
      uiLabel: gate.uiLabel,
      profileFirmId: input.profile.firmId,
    };
  }

  if (input.profile.jewellerySaleMode !== "COMPOSITE_3PCT") {
    // Only FAQ Q7 composite mode is locked for TAX-P0a; other modes need CA pack + later PR.
    throw new Error(
      `Unsupported jewellerySaleMode: ${String((input.profile as { jewellerySaleMode?: string }).jewellerySaleMode)}`,
    );
  }

  const taxableValue = round2(sumTaxable(input));
  const gstRatePct = input.profile.jewelleryCompositeRatePct;
  const gstAmount = round2(taxableValue * (gstRatePct / 100));
  const breakdown = buildBreakdown(input, taxableValue, gstRatePct, gstAmount);

  return {
    status: "ok",
    taxableValue,
    gstRatePct,
    gstAmount,
    ruleId: GST_COUNCIL_FAQ_GEMS_Q7,
    rulePackVersion: input.profile.rulePackVersion,
    breakdown,
  };
}

/**
 * Draft / Settings preview — may compute with draft rates but never claims production enable.
 * Callers must still persist via applyJewellerySaleTax (CA-gated) before posting invoices.
 *
 * TODO(TAX-P0a follow-up): wire invoice create/edit routes to production apply only.
 */
export function previewJewellerySaleTax(input: JewellerySaleTaxInput): {
  previewOnly: true;
  productionEnabled: false;
  taxableValue: number;
  gstRatePct: number;
  gstAmount: number;
  ruleId: typeof GST_COUNCIL_FAQ_GEMS_Q7;
  rulePackVersion: string;
  breakdown: TaxBreakdown;
  uiLabel: "Awaiting CA approval" | "CA approved — rates may apply";
} {
  if (input.profile.jewellerySaleMode !== "COMPOSITE_3PCT") {
    throw new Error(
      `Unsupported jewellerySaleMode: ${String((input.profile as { jewellerySaleMode?: string }).jewellerySaleMode)}`,
    );
  }
  const taxableValue = round2(sumTaxable(input));
  const gstRatePct = input.profile.jewelleryCompositeRatePct;
  const gstAmount = round2(taxableValue * (gstRatePct / 100));
  const breakdown = buildBreakdown(input, taxableValue, gstRatePct, gstAmount);
  const approved = input.profile.caApprovedAt != null && String(input.profile.caApprovedAt).trim() !== "";
  return {
    previewOnly: true,
    productionEnabled: false,
    taxableValue,
    gstRatePct,
    gstAmount,
    ruleId: GST_COUNCIL_FAQ_GEMS_Q7,
    rulePackVersion: input.profile.rulePackVersion,
    breakdown,
    uiLabel: approved ? "CA approved — rates may apply" : "Awaiting CA approval",
  };
}

/**
 * Map apply result → invoice audit columns (TAX-P0a).
 * TODO: persist on invoice create/edit once billing routes adopt this module.
 */
export function toInvoiceTaxAuditFields(result: Extract<TaxApplyResult, { status: "ok" }>): {
  tax_breakdown_json: TaxBreakdown;
  rule_id: string;
  rule_pack_version: string;
} {
  return {
    tax_breakdown_json: result.breakdown,
    rule_id: result.ruleId,
    rule_pack_version: result.rulePackVersion,
  };
}
