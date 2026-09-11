/**
 * Document verification + public invoice QR (CVsE73i6 shop parity).
 *
 * Local AVS|MTJ payload helpers live in verify-token.ts.
 * This module adds the cloud RPC path recovered from
 * production-dist-shop/assets/document-verification-*.js
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { useSettings } from "@/lib/settings-store";
import type { Invoice } from "@/lib/billing-store";
import {
  payloadFor,
  parsePayload,
  verifyPayload,
  type PayloadInput,
  type ParsedPayload,
  type VerifyOutcome,
} from "@/lib/verify-token";
import { createDocumentShareLink } from "@/lib/document-shares";
import { loadFirmCommunicationSettings } from "@/lib/firm-communication-settings";
import { publicSiteUrl } from "@/lib/website/public-site-url";

const MANDATORY_INVOICE_DOC_TYPES = new Set(["gst_invoice", "retail_invoice"]);

export {
  payloadFor,
  parsePayload,
  verifyPayload,
  type PayloadInput,
  type ParsedPayload,
  type VerifyOutcome,
};

/** Shop export `verificationQrUrl(code)` — /verify?code=… */
export function verificationQrUrl(code: string): string {
  const origin = publicSiteUrl("/").replace(/\/$/, "");
  return `${origin}/verify?code=${encodeURIComponent(code)}`;
}

export function verificationQrUrlFromPayload(payload: string): string {
  return verificationQrUrl(payload);
}

export function invoiceVerificationQrUrl(publicToken: string): string {
  const origin = publicSiteUrl("/").replace(/\/$/, "");
  return `${origin}/verify/invoice/${encodeURIComponent(publicToken)}`;
}

export function resolveVerificationQrUrl(input: {
  publicToken?: string | null;
  legacyPayload?: PayloadInput | null;
}): string {
  if (input.publicToken) return invoiceVerificationQrUrl(input.publicToken);
  if (input.legacyPayload) return verificationQrUrlFromPayload(payloadFor(input.legacyPayload));
  return "";
}

export function invoiceVerificationDocType(invoice: Pick<Invoice, "gst">): "gst_invoice" | "retail_invoice" {
  return invoice.gst === "gst3" ? "gst_invoice" : "retail_invoice";
}

export function invoiceItemSummary(invoice: Pick<Invoice, "items">): string {
  if (!invoice.items.length) return "Invoice items";
  const names = invoice.items
    .slice(0, 3)
    .map((i) => i.itemName?.trim() || i.category?.trim() || "Item")
    .join(", ");
  const more = invoice.items.length > 3 ? ` +${invoice.items.length - 3} more` : "";
  return `${invoice.items.length} item(s): ${names}${more}`;
}

export function isMandatoryInvoiceVerificationDoc(docType: string): boolean {
  return MANDATORY_INVOICE_DOC_TYPES.has(docType);
}

function extractShareTokenFromUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const t = url.indexOf("/doc/");
  if (t < 0) return undefined;
  return url.slice(t + 5).split(/[?#]/)[0] || undefined;
}

export async function registerDocumentVerification(input: {
  payload: PayloadInput;
  businessName: string;
  partyLabel?: string | null;
  invoiceDate?: string | null;
  totalPaise?: number | null;
  status?: string;
}): Promise<void> {
  const token = payloadFor(input.payload);
  const { error } = await (supabase as any).rpc("register_document_verification", {
    p_token: token,
    p_doc_type: input.payload.docType,
    p_doc_number: input.payload.docNumber,
    p_record_id: input.payload.recordId,
    p_business_name: input.businessName,
    p_party_label: input.partyLabel ?? null,
    p_invoice_date: input.invoiceDate ?? null,
    p_total_paise: input.totalPaise ?? null,
    p_status: input.status ?? "verified",
  });
  if (error) console.warn("[verify] register_document_verification failed:", error.message);
}

export async function revokeInvoiceVerification(invoice: Invoice): Promise<void> {
  const docType = invoiceVerificationDocType(invoice);
  const { error } = await (supabase as any).rpc("revoke_document_verification_by_record", {
    p_doc_type: docType,
    p_record_id: invoice.id,
    p_status: "cancelled",
  });
  if (error) console.warn("[verify] revoke_document_verification_by_record failed:", error.message);
}

export async function mintInvoiceVerification(
  invoice: Invoice,
  opts?: { ttlHours?: number; documentShareToken?: string | null },
): Promise<{
  publicToken?: string;
  accessExpiresAt?: string;
  alreadyExists?: boolean;
} | null> {
  if (invoice.status === "draft" || invoice.status === "cancelled") return null;

  const firm = useSettings.getState().firm;
  const prefs = await loadFirmCommunicationSettings();
  const docType = invoiceVerificationDocType(invoice);
  const invoiceDate = new Date(invoice.createdAt).toISOString().slice(0, 10);

  const { data, error } = await (supabase as any).rpc("mint_invoice_verification", {
    p_doc_type: docType,
    p_doc_number: invoice.invoiceNo,
    p_record_id: invoice.id,
    p_business_name: firm?.shopName || "Business",
    p_party_label: invoice.customerName || null,
    p_invoice_date: invoiceDate,
    p_total_paise: invoice.grandTotalPaise,
    p_item_summary: invoiceItemSummary(invoice),
    p_ttl_hours: opts?.ttlHours ?? prefs.documentShareTtlHours ?? 24,
    p_document_share_token: opts?.documentShareToken ?? null,
  });

  if (error) {
    console.warn("[verify] mint_invoice_verification failed:", error.message);
    return null;
  }

  const row = (data ?? {}) as Record<string, unknown>;
  return {
    publicToken: typeof row.publicToken === "string" ? row.publicToken : undefined,
    accessExpiresAt: typeof row.accessExpiresAt === "string" ? row.accessExpiresAt : undefined,
    alreadyExists: !!row.alreadyExists,
  };
}

export async function ensureInvoiceVerification(invoice: Invoice): Promise<Invoice> {
  if (
    invoice.status === "draft" ||
    invoice.status === "cancelled" ||
    invoice.verificationPublicToken
  ) {
    return invoice;
  }

  const prefs = await loadFirmCommunicationSettings();
  const branchId =
    invoice.branchId ?? useSettings.getState().selectedBranchId ?? "default";
  let shareToken = invoice.documentShareToken;

  if (!shareToken) {
    try {
      const url = await createDocumentShareLink(
        "invoice",
        invoice.id,
        branchId,
        Math.ceil((prefs.documentShareTtlHours ?? 8760) / 24),
      );
      shareToken = extractShareTokenFromUrl(url);
    } catch (err) {
      console.warn("[verify] document share for invoice failed:", err);
    }
  }

  const minted = await mintInvoiceVerification(invoice, {
    documentShareToken: shareToken,
    ttlHours: prefs.documentShareTtlHours,
  });

  if (!minted?.publicToken && !minted?.alreadyExists) return invoice;

  const next: Invoice = {
    ...invoice,
    verificationPublicToken: minted.publicToken ?? invoice.verificationPublicToken,
    verificationAccessExpiresAt: minted.accessExpiresAt
      ? Date.parse(minted.accessExpiresAt)
      : invoice.verificationAccessExpiresAt,
    documentShareToken: shareToken ?? invoice.documentShareToken,
    updatedAt: Date.now(),
  };

  if (shareToken && minted.alreadyExists && !minted.publicToken) {
    const docType = invoiceVerificationDocType(invoice);
    await (supabase as any).rpc("attach_verification_document_share", {
      p_record_id: invoice.id,
      p_doc_type: docType,
      p_document_share_token: shareToken,
      p_ttl_hours: prefs.documentShareTtlHours,
    });
  }

  return next;
}

export type PublicVerifyResult = {
  ok: boolean;
  status: string;
  message: string;
  businessName?: string;
  docType?: string;
  docNumber?: string;
  invoiceDate?: string | null;
  partyLabel?: string | null;
  totalPaise?: number | null;
  itemSummary?: string | null;
  accessExpired?: boolean;
  accessExpiresAt?: string | null;
  documentShareToken?: string | null;
};

export async function verifyPublicDocument(raw: string): Promise<PublicVerifyResult> {
  let token = raw.trim();
  try {
    if (token.includes("/verify/invoice/")) {
      const parts = new URL(token, "https://local.invalid").pathname.split("/").filter(Boolean);
      const idx = parts.indexOf("invoice");
      if (idx >= 0 && parts[idx + 1]) token = decodeURIComponent(parts[idx + 1]);
    } else if (token.includes("code=")) {
      token = new URL(token, "https://local.invalid").searchParams.get("code") || token;
    }
  } catch {
    /* keep token */
  }
  token = decodeURIComponent(token);

  // Prefer cloud RPC (shop behaviour). Fall back to local AVS|MTJ checksum.
  const { data, error } = await (supabase as any).rpc("verify_public_document", { p_token: token });
  if (!error) {
    const row = (data ?? {}) as Record<string, unknown>;
    return {
      ok: !!row.ok,
      status: String(row.status ?? "invalid"),
      message: String(
        row.message ?? (row.ok ? "This is a verified invoice." : "This invoice could not be verified."),
      ),
      businessName: typeof row.businessName === "string" ? row.businessName : undefined,
      docType: typeof row.docType === "string" ? row.docType : undefined,
      docNumber: typeof row.docNumber === "string" ? row.docNumber : undefined,
      invoiceDate: (row.invoiceDate as string | null) ?? null,
      partyLabel: (row.partyLabel as string | null) ?? null,
      totalPaise: typeof row.totalPaise === "number" ? row.totalPaise : null,
      itemSummary: typeof row.itemSummary === "string" ? row.itemSummary : null,
      accessExpired: !!row.accessExpired,
      accessExpiresAt: (row.accessExpiresAt as string | null) ?? null,
      documentShareToken: typeof row.documentShareToken === "string" ? row.documentShareToken : null,
    };
  }

  if (/^(AVS|MTJ)\|/i.test(token)) {
    const local = verifyPayload(token);
    if (local.ok) {
      return {
        ok: true,
        status: "verified",
        message: "This is a verified document (local checksum).",
        docType: local.doc.docType,
        docNumber: local.doc.docNumber,
        partyLabel: local.doc.customerName ?? null,
      };
    }
    return {
      ok: false,
      status: local.reason,
      message: error.message || "This invoice could not be verified.",
    };
  }

  return {
    ok: false,
    status: "invalid",
    message: error.message || "This invoice could not be verified.",
  };
}
