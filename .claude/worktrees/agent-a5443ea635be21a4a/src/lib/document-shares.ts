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

import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/lib/settings-store";
import { useBilling } from "@/lib/billing-store";
import { useOrders } from "@/lib/orders-store";
import { useRepairs } from "@/lib/repair-store";
import { useMfgBills } from "@/lib/manufacturing-bill-store";
import type { CommRequest } from "@/lib/comm/types";

export type ShareDocumentType = "invoice" | "order" | "repair" | "job" | "estimate";

export interface DocumentShare {
  id: string;
  document_type: ShareDocumentType;
  document_id: string;
  firm_snapshot: Record<string, any>;
  document_snapshot: Record<string, any>;
  expires_at: string;
  created_at: string;
  branch_id?: string | null;
}

function resolveDocumentData(docType: ShareDocumentType, docId: string): any {
  if (docType === "invoice" || docType === "estimate") {
    return useBilling.getState().invoices.find((i) => i.id === docId) ?? null;
  }
  if (docType === "order") {
    return useOrders.getState().orders.find((o) => o.id === docId) ?? null;
  }
  if (docType === "repair") {
    return useRepairs.getState().repairs.find((r) => r.id === docId) ?? null;
  }
  if (docType === "job") {
    const s = useMfgBills.getState() as any;
    const list: any[] = s.bills ?? s.mfgBills ?? s.items ?? [];
    return list.find((b: any) => b.id === docId) ?? null;
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
  expiresInDays = 30,
): Promise<string | null> {
  try {
    const firm = useSettings.getState().firm;
    const docSnapshot = resolveDocumentData(docType, docId);
    if (!docSnapshot) {
      console.warn("[DocumentShares] Document not found:", docType, docId);
      return null;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const { data, error } = await (supabase as any)
      .from("document_shares")
      .insert({
        document_type: docType,
        document_id: docId,
        firm_snapshot: firm,
        document_snapshot: docSnapshot,
        expires_at: expiresAt.toISOString(),
        branch_id: branchId || null,
      })
      .select("id")
      .single();

    if (error || !data) {
      console.warn("[DocumentShares] Failed to create share:", error?.message);
      return null;
    }

    const token = (data as any).id as string;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/doc/${token}`;
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
  try {
    const { data, error } = await (supabase as any)
      .from("document_shares")
      .select("*")
      .eq("id", token)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (error || !data) return null;
    return data as DocumentShare;
  } catch {
    return null;
  }
}

/** Maps CommRequest.linkedType → ShareDocumentType */
export function linkedTypeToShareDocType(linkedType: CommRequest["linkedType"]): ShareDocumentType {
  if (!linkedType) return "invoice";
  return linkedType as ShareDocumentType;
}
