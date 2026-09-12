/**
 * CA approval gate — rates must not apply in production until ca_approved_at is set.
 * Researchy AVS-27 hard rule #1 + IMPL AVS-30 TAX-P0a CA gate.
 */

import { isTaxProfileCaApproved, taxProfileUiStatus } from "./tax-profile";
import type { TaxProfile } from "./types";

export type CaGateResult =
  | { ok: true }
  | {
      ok: false;
      reason: "AWAITING_CA_APPROVAL";
      uiLabel: "Awaiting CA approval";
      message: string;
    };

/**
 * Enforce: block enabling / applying profile rates until CA approval.
 */
export function assertTaxRatesMayApply(
  profile: Pick<TaxProfile, "firmId" | "caApprovedAt">,
): CaGateResult {
  if (isTaxProfileCaApproved(profile)) {
    return { ok: true };
  }
  const { label } = taxProfileUiStatus(profile);
  return {
    ok: false,
    reason: "AWAITING_CA_APPROVAL",
    uiLabel: "Awaiting CA approval",
    message: `${label} (firm ${profile.firmId}). Edit profile in Settings; CA must approve before production rates apply.`,
  };
}

/** Soft check for UI banners / Settings toggles. */
export function canEnableTaxProfileInProduction(
  profile: Pick<TaxProfile, "caApprovedAt">,
): boolean {
  return isTaxProfileCaApproved(profile);
}
