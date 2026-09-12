/**
 * TAX-P0a foundation barrel (AVS-27 / AVS-30).
 *
 * Shipped: tax profile types + draft defaults, CA approval gate, jewellery
 * COMPOSITE_3PCT apply/preview, read-path stubs, invoice audit field mapper.
 *
 * NOT in this PR (follow-ups / separate PRs per IMPL patch order):
 * - Settings firm tax profile UI
 * - Invoice create/edit route wiring + persist tax_breakdown_json
 * - Day-close tax pack (TAX-P0b)
 * - Karigar job-work SAC 9988 / RCM (TAX-P1a)
 * - GSTR-1 draft + IRN gate (TAX-P1b)
 * - 2B mismatch + 194Q radar (TAX-P1c)
 * - AI bill explainer (TAX-P2)
 */

export * from "./types";
export * from "./tax-profile";
export * from "./ca-approval-gate";
export * from "./apply-jewellery-sale-tax";
export {
  readTaxProfileForFirm,
  getApprovedTaxProfileOrNull,
  getApprovedTaxProfileOrThrow,
  setTaxProfileFetcher,
  __setMemoryTaxProfileForTests,
  __clearMemoryTaxProfilesForTests,
} from "./read-tax-profile";
export type { TaxProfileFetcher, TaxProfileRow, TaxProfileReadResult, TaxProfileReadSource } from "./read-tax-profile";
