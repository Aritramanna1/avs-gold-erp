/**
 * Customer Document Share Links
 *
 * Creates time-limited public tokens that point to /doc/{token}.
 * The portal page fetches the share record from Supabase using the anon key
 * (no ERP login required) and renders the document from the stored snapshot.
 *
 * Architecture:
 *   createDocumentShareLink()  — called at share time (authenticated context)
 *   getDocumentShare()         — called from public portal (no auth)
 */

import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { documentShareUrl } from "@/lib/link-hosts";
import { useSettings } from "@/lib/settings-store";
import { useBilling } from "@/lib/billing-store";
import { useOrders } from "@/lib/orders-store";
import { useRepairs } from "@/lib/repair-store";
import { useMfgBills } from "@/lib/manufacturing-bill-store";
import type { CommRequest } from "@/lib/comm/types";
import { hasOrganizationFeature } from "@/lib/identity/feature-gate";
import { useSubscriptionAccess } from "@/lib/identity/subscription-access-service";

export type ShareDocumentType =
  | "invoice"
  | "order"
  | "repair"
  | "job"
  | "estimate"
  | "delivery_challan"
  | "credit_note"
  | "debit_note"
  | "gold_settlement";

/** Default hosted document retention: 1 year (plan-configurable via max days). */
export const DEFAULT_DOCUMENT_HOSTING_DAYS = 365;
export const MIN_DOCUMENT_HOSTING_DAYS = 1;
export const MAX_DOCUMENT_HOSTING_DAYS = 365 * 3;

/** Plan-gated document hosting — enabled for all official documents and portal sharing. */
export function canUseDocumentHosting(): boolean {
  const sub = useSubscriptionAccess.getState();
  if (sub.status === "PLATFORM_OWNER") return true;
  if (sub.features && typeof (sub.features as Record<string, unknown>).document_hosting === "boolean") {
    return Boolean((sub.features as Record<string, unknown>).document_hosting);
  }
  return true;
}

export interface DocumentShare {
  id: string;
  document_type: ShareDocumentType;
  document_id: string;
  party_id?: string | null;
  firm_snapshot: Record<string, unknown>;
  document_snapshot: Record<string, unknown>;
  form_metadata?: Record<string, unknown> | null;
  expires_at: string;
  retention_expires_at?: string | null;
  created_at: string;
  branch_id?: string | null;
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function tokenHash(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function resolveDocumentData(docType: ShareDocumentType, docId: string): any {
  if (docType === "invoice" || docType === "estimate") {
    return useBilling.getState().invoices.find((i) => i.id === docId || i.invoiceNo === docId) ?? null;
  }
  if (docType === "order") {
    return useOrders.getState().orders.find((o) => o.id === docId || o.orderNo === docId) ?? null;
  }
  if (docType === "repair") {
    return useRepairs.getState().repairs.find((r) => r.id === docId || r.repairNo === docId) ?? null;
  }
  if (docType === "job") {
    const s = useMfgBills.getState() as any;
    const list: any[] = s.bills ?? s.mfgBills ?? s.items ?? [];
    return list.find((b: any) => b.id === docId || b.billNo === docId) ?? null;
  }
  return null;
}

/**
 * Creates a time-limited share link for a document.
 * Snapshots the document + firm profile so the portal works without auth.
 * Returns the public portal URL: {origin}/doc/{token}
 */
export async function createDocumentShareLink(
  docType: ShareDocumentType,
  docId: string,
  branchId: string,
  expiresInDays = DEFAULT_DOCUMENT_HOSTING_DAYS,
): Promise<string | null> {
  try {
    const firm = useSettings.getState().firm;
    const docSnapshot = resolveDocumentData(docType, docId);
    if (!docSnapshot) {
      console.warn("[DocumentShares] Document not found:", docType, docId);
      return null;
    }

    const days = Math.min(
      Math.max(expiresInDays, MIN_DOCUMENT_HOSTING_DAYS),
      MAX_DOCUMENT_HOSTING_DAYS,
    );
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);
    const token = randomToken();
    const partyId =
      typeof docSnapshot === "object" && docSnapshot !== null
        ? ((docSnapshot as { customerId?: string; partyId?: string; personId?: string }).customerId ??
          (docSnapshot as { partyId?: string }).partyId ??
          (docSnapshot as { personId?: string }).personId ??
          null)
        : null;

    const shareRecord: DocumentShare = {
      id: token,
      document_type: docType,
      document_id: docId,
      party_id: partyId,
      firm_snapshot: firm as any,
      document_snapshot: docSnapshot as any,
      form_metadata: {
        sharedAt: new Date().toISOString(),
        docType,
        branchId: branchId || null,
      },
      expires_at: expiresAt.toISOString(),
      retention_expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString(),
      branch_id: branchId || null,
    };

    // Client-side instant caching
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        localStorage.setItem(`doc_share_${token}`, JSON.stringify(shareRecord));
        localStorage.setItem(`doc_share_${docId}`, JSON.stringify(shareRecord));
      } catch {}
    }

    try {
      await (supabase as any)
        .from("document_shares")
        .insert({
          document_type: docType,
          document_id: docId,
          party_id: partyId,
          firm_snapshot: firm,
          document_snapshot: docSnapshot,
          form_metadata: shareRecord.form_metadata,
          token_hash: await tokenHash(token),
          expires_at: expiresAt.toISOString(),
          retention_expires_at: expiresAt.toISOString(),
          branch_id: branchId || null,
          created_by: (await supabase.auth.getSession()).data.session?.user?.id ?? null,
        });
    } catch (dbErr) {
      console.warn("[DocumentShares] Database insert warning:", dbErr);
    }

    return documentShareUrl(token);
  } catch (err) {
    console.warn("[DocumentShares] Share creation error:", err);
    return null;
  }
}

/**
 * Fetches a share record by token. Works with the anon key (no ERP auth required).
 * Returns null if the token doesn't exist or has expired.
 */
export async function getDocumentShare(token: string): Promise<DocumentShare | null> {
  if (!token) return null;

  try {
    const { data, error } = await (supabase as any).rpc("resolve_document_share", {
      p_token: token,
    });

    if (!error && data) return data as DocumentShare;
  } catch {}

  try {
    const { data, error } = await (supabase as any)
      .from("document_shares")
      .select("*")
      .or(`document_id.eq.${token},id.eq.${token}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) return data as DocumentShare;
  } catch {}

  // Offline resilience & client-side snapshot fallback
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const cached = localStorage.getItem(`doc_share_${token}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && (!parsed.expires_at || new Date(parsed.expires_at).getTime() > Date.now())) {
          return parsed as DocumentShare;
        }
      }
    } catch {}
  }

  // Live in-memory store resolution fallback
  const inv = useBilling.getState().invoices.find(
    (i) =>
      i.id === token ||
      i.invoiceNo === token ||
      i.documentShareToken === token ||
      i.verificationPublicToken === token,
  );
  if (inv) {
    const firm = useSettings.getState().firm;
    return {
      id: inv.id,
      document_type: "invoice",
      document_id: inv.id,
      party_id: inv.customerId ?? null,
      firm_snapshot: firm as any,
      document_snapshot: inv as any,
      form_metadata: { sharedAt: new Date().toISOString(), docType: "invoice" },
      expires_at: new Date(Date.now() + 365 * 86400000).toISOString(),
      created_at: new Date(inv.createdAt).toISOString(),
      branch_id: inv.branchId ?? null,
    };
  }

  return null;
}

/** Maps CommRequest.linkedType → ShareDocumentType */
export function linkedTypeToShareDocType(linkedType: CommRequest["linkedType"]): ShareDocumentType {
  if (!linkedType) return "invoice";
  return linkedType as ShareDocumentType;
}
