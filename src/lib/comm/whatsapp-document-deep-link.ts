/**
 * WhatsApp deep-link fallback with a firm-scoped, expiring document URL.
 * Used when Official API / OpenWA / native file share are unavailable.
 * Opening wa.me is NOT delivery — callers log deep_link_opened / share_initiated.
 */
import { isValidWaPhone, waMobileUrl } from "@/lib/wa-link";
import { isNativeApp } from "@/lib/native/platform";
import { shareContent } from "@/lib/native/share";
import type { PrintDocType } from "@/lib/print-engine/types";
import { printDocTypeToShareDocumentType } from "@/lib/print-engine/share-doc-type";

export interface WhatsAppDeepLinkDocInput {
  docType: PrintDocType;
  recordId: string;
  phone?: string | null;
  caption: string;
  branchId?: string;
}

export interface WhatsAppDeepLinkDocResult {
  ok: boolean;
  error?: string;
  shareUrl?: string | null;
  deepLinkUrl?: string;
  deliveryStatus: "deep_link_opened" | "failed";
}

/**
 * Mint secure /doc/{token} when the PrintDocType maps to document_shares;
 * open WhatsApp with caption + link. Never invents unrestricted public dumps.
 */
export async function openWhatsAppDocumentDeepLink(
  input: WhatsAppDeepLinkDocInput,
): Promise<WhatsAppDeepLinkDocResult> {
  let shareUrl: string | null = null;
  const shareType = printDocTypeToShareDocumentType(input.docType);
  if (shareType) {
    const { createDocumentShareLink } = await import("@/lib/document-shares");
    const { useBranch } = await import("@/lib/branch-store");
    const resolvedBranch = input.branchId || useBranch.getState().currentBranchId || "MAIN";
    try {
      shareUrl = await createDocumentShareLink(shareType, input.recordId, resolvedBranch);
    } catch (err) {
      console.error("[WhatsAppDeepLink] Share mint failed:", err);
      shareUrl = null;
    }
  }

  const message = shareUrl
    ? `${input.caption}\n\nDocument (secure link): ${shareUrl}`
    : `${input.caption}\n\n(Secure document link unavailable for this document type or public share is disabled in firm communication settings.)`;

  if (isNativeApp()) {
    await shareContent({
      title: "Share on WhatsApp",
      text: message,
    });
    return {
      ok: true,
      shareUrl,
      deliveryStatus: "deep_link_opened",
    };
  }

  if (input.phone && isValidWaPhone(input.phone)) {
    const url = waMobileUrl(input.phone, message);
    window.open(url, "_blank", "noopener,noreferrer");
    return {
      ok: true,
      shareUrl,
      deepLinkUrl: url,
      deliveryStatus: "deep_link_opened",
    };
  }

  try {
    await navigator.clipboard.writeText(message);
    return {
      ok: true,
      shareUrl,
      deliveryStatus: "deep_link_opened",
      error: shareUrl
        ? "Secure link copied — paste into WhatsApp."
        : "Message copied. Add a WhatsApp number or enable public document share.",
    };
  } catch {
    return {
      ok: false,
      shareUrl,
      deliveryStatus: "failed",
      error: "Could not open WhatsApp deep link.",
    };
  }
}
