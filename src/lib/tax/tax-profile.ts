/**
 * Tax profile helpers (TAX-P0a foundation).
 * Additive module — does not replace legacy src/lib/tax-profiles.ts taxable-base helpers.
 */

import {
  DRAFT_RULE_PACK_VERSION,
  type TaxProfile,
} from "./types";

/**
 * Build a draft (not production-enabled) profile.
 * FAQ-locked draft defaults only — CA must set caApprovedAt before rates apply in production.
 * No real GSTIN hardcoded.
 */
export function createDraftTaxProfile(firmId: string): TaxProfile {
  return {
    firmId,
    jewellerySaleMode: "COMPOSITE_3PCT",
    // GST Council Sectoral FAQ — Gems & Jewellery Q7 (composite on total taxable value).
    jewelleryCompositeRatePct: 3,
    jobWorkSac: "9988",
    // FAQ Q8 — registered job-work labour; RCM path is a later PR (TAX-P1a).
    jobWorkRatePct: 5,
    jewelleryHsn: "7113",
    eInvoiceRequired: false,
    tdsGoodsBuyer: false,
    tdsRatePct: 0.1,
    tdsVendorThresholdInr: 5_000_000,
    // Jurisdiction-sensitive — default MANUAL_CA until firm CA picks FULL_TV / MARGIN_32_5.
    oldGoldMode: "MANUAL_CA",
    rulePackVersion: DRAFT_RULE_PACK_VERSION,
    gstinPlaceholder: "SET_IN_FIRM_SETTINGS",
    caApprovedAt: null,
    caApprovedBy: null,
  };
}

export function isTaxProfileCaApproved(profile: Pick<TaxProfile, "caApprovedAt">): boolean {
  return profile.caApprovedAt != null && String(profile.caApprovedAt).trim() !== "";
}

/** Production flag requires ca_approved_at (IMPL CA gate). */
export function isTaxProfileProductionEnabled(profile: Pick<TaxProfile, "caApprovedAt">): boolean {
  return isTaxProfileCaApproved(profile);
}

export function taxProfileUiStatus(
  profile: Pick<TaxProfile, "caApprovedAt">,
): { productionEnabled: boolean; label: string } {
  if (isTaxProfileProductionEnabled(profile)) {
    return { productionEnabled: true, label: "CA approved — rates may apply" };
  }
  return { productionEnabled: false, label: "Awaiting CA approval" };
}

/**
 * Mark CA approval (stub for Settings / admin write path).
 * Does not invent rates — only records approval metadata.
 */
export function withCaApproval(
  profile: TaxProfile,
  approvedBy: string,
  approvedAtIso: string = new Date().toISOString(),
): TaxProfile {
  return {
    ...profile,
    caApprovedAt: approvedAtIso,
    caApprovedBy: approvedBy,
    updatedAt: approvedAtIso,
    updatedBy: approvedBy,
  };
}

/** Clear CA approval when profile rates/modes change materially (Settings write path). */
export function clearCaApprovalOnMaterialEdit(profile: TaxProfile, updatedBy?: string): TaxProfile {
  return {
    ...profile,
    caApprovedAt: null,
    caApprovedBy: null,
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy ?? null,
  };
}

export function toTaxProfileRow(profile: TaxProfile): {
  firm_id: string;
  profile: TaxProfile;
  ca_approved_at: string | null;
  ca_approved_by: string | null;
} {
  return {
    firm_id: profile.firmId,
    profile,
    ca_approved_at: profile.caApprovedAt,
    ca_approved_by: profile.caApprovedBy,
  };
}

export function fromTaxProfileRow(row: {
  firm_id: string;
  profile: Partial<TaxProfile> | null;
  ca_approved_at: string | null;
  ca_approved_by: string | null;
}): TaxProfile {
  const draft = createDraftTaxProfile(row.firm_id);
  const merged: TaxProfile = {
    ...draft,
    ...(row.profile ?? {}),
    firmId: row.firm_id,
    caApprovedAt: row.ca_approved_at,
    caApprovedBy: row.ca_approved_by,
  };
  return merged;
}
