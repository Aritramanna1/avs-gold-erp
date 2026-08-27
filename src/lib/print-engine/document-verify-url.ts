/**
 * Resolve QR payload for printed documents.
 * Prefer a public /doc/{token} share URL; fall back to /verify?payload=…
 * so scans never point at private ERP routes or localhost in production.
 */
import { payloadFor } from "@/lib/verify-token";
import type { PrintDocType } from "@/lib/printlog-store";
import { createDocumentShareLink, type ShareDocumentType } from "@/lib/document-shares";
import { publicDocumentUrl } from "@/lib/public-origin";
import { useSettings } from "@/lib/settings-store";

function mapPrintDocToShareType(docType: PrintDocType): ShareDocumentType | null {
  switch (docType) {
    case "retail_invoice":
    case "gst_invoice":
    case "invoice_quote_preview":
      return "invoice";
    case "order_slip":
    case "job_card":
      return "order";
    case "repair_receipt":
    case "repair_delivery_slip":
    case "repair_invoice":
      return "repair";
    case "manufacturing_bill":
      return "job";
    default:
      return null;
  }
}

export async function resolveDocumentVerifyQrContent(input: {
  docType: PrintDocType;
  docNumber: string;
  recordId: string;
  createdAt?: number | string | Date;
}): Promise<{ content: string; kind: "doc_share" | "verify_payload_url" }> {
  const shareType = mapPrintDocToShareType(input.docType);
  const branchId = useSettings.getState().selectedBranchId || "MAIN";
  if (shareType && input.recordId) {
    try {
      const url = await createDocumentShareLink(shareType, input.recordId, branchId, 30);
      if (url && !url.includes("localhost") && !url.includes("127.0.0.1")) {
        return { content: url, kind: "doc_share" };
      }
      if (url) {
        // Re-host path on production public origin if create used a bad origin.
        const token = url.split("/doc/")[1];
        if (token) {
          return { content: publicDocumentUrl(`/doc/${token}`), kind: "doc_share" };
        }
      }
    } catch (err) {
      console.warn("[print-qr] share link failed, falling back to verify URL:", err);
    }
  }

  const payload = payloadFor({
    docType: input.docType,
    docNumber: input.docNumber,
    recordId: input.recordId,
    createdAt: input.createdAt,
  });
  return {
    content: publicDocumentUrl(`/verify?payload=${encodeURIComponent(payload)}`),
    kind: "verify_payload_url",
  };
}
