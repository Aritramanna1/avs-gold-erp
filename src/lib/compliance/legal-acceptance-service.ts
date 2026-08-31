/**
 * Server-backed legal acceptance — pending check + auditable record.
 * Minimal fields only: no IP, advertising IDs, or extra device fingerprints.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { APP_VERSION } from "@/lib/app-info";
import { nativePlatform, isNativeApp } from "@/lib/native/platform";
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
  type LegalDocumentType,
  getCurrentLegalDocuments,
} from "@/lib/compliance/legal-policies";

export type AcceptanceMethod =
  | "scroll_gate"
  | "invite_pre_auth_scroll"
  | "trial_pre_auth_scroll"
  | "legacy_checkbox_sync";

export type PendingLegalDocument = {
  document_type: LegalDocumentType;
  version: string;
  title: string;
  body_md: string;
  effective_at: string;
};

export type ClientPendingAcceptance = {
  termsVersion: string;
  privacyVersion: string;
  method: AcceptanceMethod;
  completedAt: string;
};

const CLIENT_PENDING_KEY = "ornexa-legal-pending-acceptance-v1";

export function resolveAcceptancePlatform(): string {
  if (isNativeApp()) return nativePlatform();
  if (typeof navigator !== "undefined" && /Electron/i.test(navigator.userAgent)) {
    return "desktop";
  }
  return "web";
}

export function stashClientPendingAcceptance(
  method: AcceptanceMethod,
): void {
  const payload: ClientPendingAcceptance = {
    termsVersion: CURRENT_TERMS_VERSION,
    privacyVersion: CURRENT_PRIVACY_VERSION,
    method,
    completedAt: new Date().toISOString(),
  };
  try {
    sessionStorage.setItem(CLIENT_PENDING_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota */
  }
}

export function readClientPendingAcceptance(): ClientPendingAcceptance | null {
  try {
    const raw = sessionStorage.getItem(CLIENT_PENDING_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ClientPendingAcceptance;
  } catch {
    return null;
  }
}

export function clearClientPendingAcceptance(): void {
  try {
    sessionStorage.removeItem(CLIENT_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function clientPendingMatchesCurrent(
  pending: ClientPendingAcceptance | null,
): boolean {
  if (!pending) return false;
  return (
    pending.termsVersion === CURRENT_TERMS_VERSION &&
    pending.privacyVersion === CURRENT_PRIVACY_VERSION
  );
}

/** Fallback when RPC unavailable — treat current in-code docs as pending. */
function localPendingFallback(): PendingLegalDocument[] {
  return getCurrentLegalDocuments().map((d) => ({
    document_type: d.documentType,
    version: d.version,
    title: d.title,
    body_md: d.body,
    effective_at: d.effectiveDate,
  }));
}

export async function fetchPendingLegalDocuments(): Promise<PendingLegalDocument[]> {
  const { data, error } = await supabase.rpc("get_pending_legal_policies" as never);
  if (error) {
    const { loadErpSessionCache, legalCacheMatchesCurrent } = await import(
      "@/lib/offline/erp-session-cache"
    );
    const cached = await loadErpSessionCache();
    if (legalCacheMatchesCurrent(cached?.legalCleared)) {
      return [];
    }
    console.warn("[legal] get_pending_legal_policies failed, using local fallback", error.message);
    return localPendingFallback();
  }
  const rows = (data ?? []) as PendingLegalDocument[];
  if (rows.length === 0) {
    const { patchErpSessionCache } = await import("@/lib/offline/erp-session-cache");
    void patchErpSessionCache({
      legalCleared: {
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
      },
    }).catch(() => undefined);
  }
  return rows;
}

export async function recordLegalAcceptance(opts: {
  documentType: LegalDocumentType;
  version: string;
  method: AcceptanceMethod;
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc("record_legal_acceptance" as never, {
    p_document_type: opts.documentType,
    p_policy_version: opts.version,
    p_app_version: APP_VERSION,
    p_platform: resolveAcceptancePlatform(),
    p_acceptance_method: opts.method,
  } as never);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function recordAllCurrentLegalAcceptances(
  method: AcceptanceMethod,
): Promise<{ ok: boolean; error?: string }> {
  for (const doc of getCurrentLegalDocuments()) {
    const res = await recordLegalAcceptance({
      documentType: doc.documentType,
      version: doc.version,
      method,
    });
    if (!res.ok) return res;
  }
  clearClientPendingAcceptance();
  return { ok: true };
}
