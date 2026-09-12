/**
 * Read paths for firm tax profiles (TAX-P0a foundation stubs).
 *
 * Prefer these helpers over inventing rates at call sites.
 * When no row is supplied, return a draft profile (not CA-approved).
 *
 * TODO(TAX-P0a): Settings UI section to edit + request CA approval.
 * TODO(TAX-P0a): Wire billing-store / invoice routes to getApprovedTaxProfileOrThrow.
 * TODO(TAX-P0a): Inject real Supabase `.from('tax_profiles')` fetcher in app bootstrap.
 */

import { assertTaxRatesMayApply } from "./ca-approval-gate";
import { createDraftTaxProfile, fromTaxProfileRow } from "./tax-profile";
import type { TaxProfile } from "./types";

export type TaxProfileReadSource = "supabase" | "draft_fallback" | "memory" | "injected";

export type TaxProfileReadResult = {
  profile: TaxProfile;
  source: TaxProfileReadSource;
  uiLabel: "Awaiting CA approval" | "CA approved — rates may apply";
};

export type TaxProfileRow = {
  firm_id: string;
  profile: Partial<TaxProfile> | null;
  ca_approved_at: string | null;
  ca_approved_by: string | null;
};

/** Optional DB/read adapter — keep foundation free of secrets / client wiring. */
export type TaxProfileFetcher = (firmId: string) => Promise<TaxProfileRow | null>;

let injectedFetcher: TaxProfileFetcher | null = null;

export function setTaxProfileFetcher(fetcher: TaxProfileFetcher | null): void {
  injectedFetcher = fetcher;
}

function uiLabelFor(profile: TaxProfile): TaxProfileReadResult["uiLabel"] {
  return profile.caApprovedAt != null && String(profile.caApprovedAt).trim() !== ""
    ? "CA approved — rates may apply"
    : "Awaiting CA approval";
}

/** In-memory override for unit tests / local stubs (no secrets). */
const memoryProfiles = new Map<string, TaxProfile>();

export function __setMemoryTaxProfileForTests(profile: TaxProfile): void {
  memoryProfiles.set(profile.firmId, profile);
}

export function __clearMemoryTaxProfilesForTests(): void {
  memoryProfiles.clear();
}

/**
 * Read firm tax profile. Never invents rates beyond draft FAQ-locked defaults
 * when no row exists; draft is always caApprovedAt=null.
 */
export async function readTaxProfileForFirm(firmId: string): Promise<TaxProfileReadResult> {
  const mem = memoryProfiles.get(firmId);
  if (mem) {
    return { profile: mem, source: "memory", uiLabel: uiLabelFor(mem) };
  }

  if (injectedFetcher) {
    try {
      const row = await injectedFetcher(firmId);
      if (row) {
        const profile = fromTaxProfileRow(row);
        return { profile, source: "injected", uiLabel: uiLabelFor(profile) };
      }
    } catch {
      // fall through to draft
    }
  }

  const draft = createDraftTaxProfile(firmId);
  return { profile: draft, source: "draft_fallback", uiLabel: uiLabelFor(draft) };
}

/**
 * Production read — returns null if CA has not approved (rates must not apply).
 */
export async function getApprovedTaxProfileOrNull(firmId: string): Promise<TaxProfile | null> {
  const { profile } = await readTaxProfileForFirm(firmId);
  const gate = assertTaxRatesMayApply(profile);
  return gate.ok ? profile : null;
}

/**
 * Production read — throws with UI-safe message when awaiting CA approval.
 */
export async function getApprovedTaxProfileOrThrow(firmId: string): Promise<TaxProfile> {
  const { profile } = await readTaxProfileForFirm(firmId);
  const gate = assertTaxRatesMayApply(profile);
  if (!gate.ok) {
    throw new Error(gate.message);
  }
  return profile;
}
