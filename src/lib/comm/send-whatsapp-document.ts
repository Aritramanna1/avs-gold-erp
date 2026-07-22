/**
 * Send an ERP document over WhatsApp with its PDF attached — the manual
 * "Send on WhatsApp" doc-menu path (Invoice/Order/Repair/Estimate). Reuses
 * the Universal Print Engine for the PDF (no second generator) and
 * WasenderAPI's real upload+send pipeline (the same wasenderClient calls
 * the automated delivery-challan/manufacturing-bill/gold-settlement path in
 * whatsapp-wasender.ts uses) — so this manual path actually attaches the
 * document instead of a caption-only text message.
 *
 * Pipeline: generate PDF -> validate -> upload -> validate upload -> send ->
 * log -> return. Transient upload/send failures (network error, 429, 5xx)
 * retry with exponential backoff (max 3 attempts); validation failures
 * (bad phone, missing PDF, non-HTTP URL) fail immediately, no retry.
 */
import { resolvePrintContext } from "@/lib/print-engine/data-mapper";
import { usePrintTemplates } from "@/lib/print-engine/template-store";
import { generateDocumentPdf } from "@/lib/print-engine/pdf/generate";
import { useSettings } from "@/lib/settings-store";
import { useCommSettings } from "./comm-settings-store";
import { wasenderClient, isWasenderBridgeAvailable } from "./wasender-client";
import { withRetry } from "./fetch-with-timeout";
import { isValidWaPhone, cleanPhone } from "@/lib/wa-link";
import { useCommLog } from "@/lib/comm-log-store";
import type { PrintDocType } from "@/lib/print-engine/types";

export interface WhatsAppDocRequest {
  docType: PrintDocType;
  recordId: string;
  phone: string | undefined | null;
  /** Message that rides with the document (WhatsApp caption). */
  caption?: string;
  recipientName?: string;
  branchId?: string;
  linkedType?:
    "invoice" | "order" | "job" | "repair" | "estimate" | "delivery_challan" | "gold_settlement";
  linkedId?: string;
  /** Called at each pipeline stage so the UI can show live progress. */
  onProgress?: (stage: "generating" | "uploading" | "sending" | "retrying") => void;
}

export interface WhatsAppDocResult {
  ok: boolean;
  error?: string;
  /** True only if the actual PDF was attached; false = caption-only (deep link / no host). */
  attached: boolean;
}

const MAX_UPLOAD_BYTES = 16 * 1024 * 1024; // WasenderAPI's practical document ceiling

function makeCorrelationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `wadoc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function sendWhatsAppDocument(req: WhatsAppDocRequest): Promise<WhatsAppDocResult> {
  const correlationId = makeCorrelationId();
  const branchId = req.branchId || "MAIN";

  const log = (fields: Partial<import("@/lib/comm-log-store").CommEvent>) => {
    try {
      useCommLog.getState().record({
        kind: fields.deliveryStatus === "sent" ? "manually_sent" : "prepared",
        templateKind: req.docType as unknown as import("@/lib/wa-templates-store").TemplateKind,
        templateName: req.docType,
        target: "customer",
        recipientLabel: req.recipientName ?? "Customer",
        recipientPhone: req.phone ?? "",
        linkedType: (req.linkedType ?? "order") as import("@/lib/comm-log-store").CommLinkedType,
        linkedId: req.linkedId ?? req.recordId,
        body: req.caption ?? req.docType,
        providerName: "WhatsApp (WasenderAPI)",
        correlationId,
        ...fields,
      });
    } catch (err) {
      console.error("[sendWhatsAppDocument] Failed to write communication log:", err);
    }
  };

  // ── 1. Pre-flight validation — nothing invalid reaches the API ──────────
  if (!isValidWaPhone(req.phone ?? "")) {
    const error = `"${req.phone}" is not a valid WhatsApp number.`;
    log({ deliveryStatus: "failed", failureReason: error, sendStatus: "failed" });
    return { ok: false, error, attached: false };
  }
  if (!isWasenderBridgeAvailable()) {
    const error = "WasenderAPI bridge unavailable (desktop app required).";
    log({ deliveryStatus: "failed", failureReason: error, sendStatus: "failed" });
    return { ok: false, error, attached: false };
  }
  const wasenderConfig = useCommSettings.getState().getWasenderConfig(branchId);
  if (!wasenderConfig || !wasenderConfig.isActive) {
    const error = "WasenderAPI is not configured/active for this branch.";
    log({ deliveryStatus: "failed", failureReason: error, sendStatus: "failed" });
    return { ok: false, error, attached: false };
  }
  const hasApiKey = await wasenderClient.hasApiKey();
  if (!hasApiKey) {
    const error = "WasenderAPI session API Key is not set — cannot authenticate the send.";
    log({ deliveryStatus: "failed", failureReason: error, sendStatus: "failed" });
    return { ok: false, error, attached: false };
  }
  if (typeof navigator !== "undefined" && "onLine" in navigator && !navigator.onLine) {
    const error = "No internet connection.";
    log({ deliveryStatus: "failed", failureReason: error, sendStatus: "failed" });
    return { ok: false, error, attached: false };
  }

  const baseUrl = wasenderConfig.settings.api_base_url;
  if (baseUrl) wasenderClient.setBaseUrl(baseUrl);

  // ── 2. Generate the PDF (shared engine — same output as print/preview) ──
  req.onProgress?.("generating");
  const data = resolvePrintContext(req.docType, req.recordId);
  if (!data) {
    const error = `No printable data for ${req.docType}.`;
    log({ deliveryStatus: "failed", failureReason: error, sendStatus: "failed" });
    return { ok: false, error, attached: false };
  }
  const template = usePrintTemplates.getState().getForDocType(req.docType);
  const firm = useSettings.getState().firm;

  let fileName = `${req.docType}.pdf`;
  let blob: Blob;
  try {
    const pdf = await generateDocumentPdf(data, template, firm);
    fileName = pdf.fileName;
    blob = pdf.blob;
  } catch (err) {
    const error = err instanceof Error ? err.message : "PDF generation failed.";
    log({ deliveryStatus: "failed", failureReason: error, sendStatus: "failed" });
    return { ok: false, error, attached: false };
  }
  if (!blob || blob.size === 0) {
    const error = "Generated PDF is empty.";
    log({ deliveryStatus: "failed", failureReason: error, sendStatus: "failed" });
    return { ok: false, error, attached: false };
  }
  if (blob.size > MAX_UPLOAD_BYTES) {
    const error = `PDF too large to send (${(blob.size / 1024 / 1024).toFixed(1)} MB, max ${MAX_UPLOAD_BYTES / 1024 / 1024} MB).`;
    log({ deliveryStatus: "failed", failureReason: error, sendStatus: "failed" });
    return { ok: false, error, attached: false };
  }
  const mimeType = blob.type || "application/pdf";
  if (mimeType !== "application/pdf") {
    const error = `Unexpected MIME type for generated document: ${mimeType}`;
    log({ deliveryStatus: "failed", failureReason: error, sendStatus: "failed" });
    return { ok: false, error, attached: false };
  }

  // ── 3. Upload (retry on transient failures) ──────────────────────────────
  req.onProgress?.("uploading");
  const uploadStartedAt = Date.now();
  const uploadRes = await withRetry(() => wasenderClient.uploadMedia(blob, fileName, mimeType), {
    onRetry: () => req.onProgress?.("retrying"),
  });
  if (!uploadRes.ok || !uploadRes.url) {
    const error = `Upload failed: ${uploadRes.error || "no public URL returned"}`;
    log({
      uploadStatus: "failed",
      uploadTime: Date.now() - uploadStartedAt,
      uploadResponse: JSON.stringify(uploadRes.raw ?? uploadRes.error ?? null).slice(0, 2000),
      sendStatus: "failed",
      deliveryStatus: "failed",
      retryCount: uploadRes.retryCount,
      failureReason: error,
    });
    return { ok: false, error, attached: false };
  }
  const publicUrl = uploadRes.url;
  if (!publicUrl.startsWith("http://") && !publicUrl.startsWith("https://")) {
    const error = "Upload returned a non-HTTP URL — local paths are prohibited.";
    log({
      uploadStatus: "failed",
      uploadTime: Date.now() - uploadStartedAt,
      documentUrl: publicUrl,
      sendStatus: "failed",
      deliveryStatus: "failed",
      failureReason: error,
    });
    return { ok: false, error, attached: false };
  }

  // ── 4. Send (retry on transient failures) ────────────────────────────────
  req.onProgress?.("sending");
  const caption = req.caption ?? `${data.title} ${data.docNumber}`;
  const phone = cleanPhone(req.phone!);
  const sendRes = await withRetry(
    () => wasenderClient.sendDocument(phone, publicUrl, fileName, caption),
    { onRetry: () => req.onProgress?.("retrying") },
  );

  if (!sendRes.ok) {
    const error = `Send failed: ${sendRes.error || `HTTP ${sendRes.status}`}`;
    log({
      uploadStatus: "success",
      uploadTime: Date.now() - uploadStartedAt,
      documentUrl: publicUrl,
      sendStatus: "failed",
      sendResponse: JSON.stringify(sendRes.data ?? null).slice(0, 2000),
      deliveryStatus: "failed",
      retryCount: sendRes.retryCount,
      failureReason: error,
    });
    return { ok: false, error, attached: false };
  }

  log({
    uploadStatus: "success",
    uploadTime: Date.now() - uploadStartedAt,
    documentUrl: publicUrl,
    sendStatus: "success",
    sendResponse: JSON.stringify(sendRes.data ?? null).slice(0, 2000),
    deliveryStatus: "sent",
    retryCount: sendRes.retryCount,
  });
  return { ok: true, attached: true };
}
