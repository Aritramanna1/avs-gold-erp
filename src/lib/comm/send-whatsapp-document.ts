/**
 * Send an ERP document over WhatsApp — canonical Print Engine PDF for all modes.
 *
 * Delivery order:
 * 1. Official WhatsApp API / OpenWA → upload PDF + send as real document
 * 2. Native / Web file share → share PDF via OS share sheet
 * 3. Deep-link fallback → secure expiring /doc/{token} + wa.me
 */
import { isValidWaPhone } from "@/lib/wa-link";
import type { PrintDocType } from "@/lib/print-engine/types";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { canShareFiles, shareBusinessDocument } from "@/lib/native/share-business-document";
import { isNativeApp } from "@/lib/native/platform";
import { resolvePrintContext } from "@/lib/print-engine/data-mapper";
import {
  isLegacyPhpWhatsAppProvider,
  canSendLegacyPhpWhatsApp,
  legacyPhpBlockedReason,
  loadCommunicationPolicy,
} from "./communication-policy";
import { resolveWhatsAppDeliveryModeAsync } from "./whatsapp-mode-router";
import { buildSendDedupKey, shouldBlockDuplicateSend } from "./whatsapp-send-guard";
import { openWhatsAppDocumentDeepLink } from "./whatsapp-document-deep-link";

export interface WhatsAppDocRequest {
  docType: PrintDocType;
  recordId: string;
  phone: string | undefined | null;
  caption?: string;
  recipientName?: string;
  branchId?: string;
  linkedType?:
    | "invoice"
    | "order"
    | "job"
    | "repair"
    | "estimate"
    | "portal_invitation"
    | "delivery_challan"
    | "credit_note"
    | "debit_note"
    | "gold_settlement";
  linkedId?: string;
}

export interface WhatsAppDocResult {
  ok: boolean;
  error?: string;
  attached: boolean;
  deliveryMode?: string;
  deliveryStatus?: string;
}

export async function sendWhatsAppDocument(req: WhatsAppDocRequest): Promise<WhatsAppDocResult> {
  const policy = await loadCommunicationPolicy();
  const modeRes = await resolveWhatsAppDeliveryModeAsync(req.branchId);

  const data = resolvePrintContext(req.docType, req.recordId);
  if (!data) {
    return { ok: false, error: `No printable data for ${req.docType}.`, attached: false };
  }
  const caption = req.caption ?? `${data.title} ${data.docNumber}`;

  // 1) Official API / OpenWA — real PDF document attachment
  if (modeRes.mode === "openwa" || modeRes.mode === "official_api") {
    if (!isValidWaPhone(req.phone ?? "")) {
      return {
        ok: false,
        error: `"${req.phone}" is not a valid WhatsApp number.`,
        attached: false,
        deliveryMode: modeRes.mode,
      };
    }

    const providerType = modeRes.providerType ?? "whatsapp_deep_link";
    if (isLegacyPhpWhatsAppProvider(providerType) && !canSendLegacyPhpWhatsApp(policy)) {
      return {
        ok: false,
        error: legacyPhpBlockedReason(policy) ?? "Legacy PHP WhatsApp is disabled.",
        attached: false,
      };
    }

    let documentUrl: string | null = null;
    let fileName = `${req.docType}.pdf`;
    try {
      const { generatePrintEnginePdf } = await import("@/lib/native/document-output");
      const pdf = await generatePrintEnginePdf(req.docType, req.recordId);
      if (!pdf) {
        return {
          ok: false,
          error: "Could not generate document PDF.",
          attached: false,
          deliveryMode: modeRes.mode,
          deliveryStatus: "failed",
        };
      }
      fileName = pdf.fileName;
      const { uploadToHostingerServer } = await import("@/lib/hostinger-client");
      const uploaded = await uploadToHostingerServer(
        pdf.blob,
        pdf.fileName,
        "invoices",
        req.recordId,
      );
      documentUrl = uploaded.fileUrl;
    } catch (err) {
      console.error("[sendWhatsAppDocument] PDF generation/upload failed:", err);
      return {
        ok: false,
        error: "Could not generate or upload document PDF.",
        attached: false,
        deliveryMode: modeRes.mode,
        deliveryStatus: "failed",
      };
    }

    const adapter = modeRes.mode === "openwa" ? "openwa" : "official";
    const dedupKey = buildSendDedupKey({
      branchId: req.branchId,
      phone: req.phone ?? undefined,
      message: caption,
      documentUrl: documentUrl ?? undefined,
    });
    if (shouldBlockDuplicateSend(dedupKey)) {
      return {
        ok: false,
        error: "Duplicate send blocked — wait a few seconds and retry.",
        attached: false,
        deliveryMode: modeRes.mode,
        deliveryStatus: "failed",
      };
    }

    try {
      const { data: result, error } = await (supabase as any).functions.invoke("send-whatsapp", {
        body: {
          branchId: req.branchId ?? "MAIN",
          phone: req.phone,
          message: caption,
          adapter,
          documentUrl,
          fileName,
          mimeType: "application/pdf",
        },
      });
      const ok = !error && result?.ok === true;
      return {
        ok,
        error: error?.message || result?.error,
        attached: !!documentUrl && ok,
        deliveryMode: modeRes.mode,
        deliveryStatus: ok ? (result?.status ?? "queued") : "failed",
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "WhatsApp document send failed.",
        attached: false,
        deliveryMode: modeRes.mode,
        deliveryStatus: "failed",
      };
    }
  }

  // 2) Native / Web file share
  if (modeRes.mode === "native_share" || isNativeApp() || canShareFiles()) {
    const result = await shareBusinessDocument({
      title: data.title,
      text: caption,
      docType: req.docType,
      recordId: req.recordId,
      format: "pdf",
      linkedType: req.linkedType,
      linkedId: req.linkedId ?? req.recordId,
      recipientLabel: req.recipientName,
      recipientPhone: req.phone ?? undefined,
      branchId: req.branchId,
    });
    if (result.initiated && !result.downloaded) {
      return {
        ok: true,
        error: result.error,
        attached: true,
        deliveryMode: "native_share",
        deliveryStatus: "share_initiated",
      };
    }
    // Desktop download-only — continue to deep-link so WhatsApp still opens.
    if (result.initiated && result.downloaded && !(req.phone && isValidWaPhone(req.phone))) {
      return {
        ok: true,
        attached: true,
        deliveryMode: "download",
        deliveryStatus: "share_initiated",
        error: "PDF downloaded. Add a WhatsApp number to open a deep link.",
      };
    }
  }

  // 3) Deep-link fallback — secure expiring document URL
  const deep = await openWhatsAppDocumentDeepLink({
    docType: req.docType,
    recordId: req.recordId,
    phone: req.phone,
    caption,
    branchId: req.branchId,
  });
  return {
    ok: deep.ok,
    error: deep.error,
    attached: !!deep.shareUrl,
    deliveryMode: "deep_link",
    deliveryStatus: deep.deliveryStatus,
  };
}
