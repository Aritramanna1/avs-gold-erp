/**
 * WasenderAPI WhatsApp provider.
 *
 * Delivery goes through the Supabase Edge Function, which holds the provider
 * credential. A PDF/document takes priority over a plain
 * text body: the recipient receives the actual ERP document with the message
 * as its caption, matching the Cloud API / OpenWA providers.
 *
 * Failure semantics (network down, no session, bridge absent in the browser
 * build, non-2xx) all return success:false so:
 *   1. commService tries the next provider by priority — normally the
 *      deep-link fallback — and
 *   2. if every provider fails, comm-queue.ts durably queues for retry.
 * The provider never throws; the ERP is never blocked by WhatsApp being down.
 */
import type {
  CommProvider,
  CommRequest,
  CommResult,
  ProviderConfig,
  ResolvedContent,
} from "../types";
import { WHATSAPP_KEYS } from "../types";
import { wasenderClient, isWasenderBridgeAvailable } from "../wasender-client";
import { cleanPhone } from "@/lib/wa-link";
import { generateDocumentPdf, type PdfDocumentType } from "@/lib/pdf/document-pdf-generator";
import { useSettings } from "@/lib/settings-store";
import { useBilling } from "@/lib/billing-store";
import { useOrders } from "@/lib/orders-store";
import { useRepairs } from "@/lib/repair-store";
import { useMfgBills } from "@/lib/manufacturing-bill-store";
import { useDeliveryChallans } from "@/lib/billing-documents-store";
import { useGoldSettlement } from "@/lib/gold-settlement-store";

function templateToPdfType(template: string, linkedType?: string): PdfDocumentType | null {
  if (template === "delivery_challan" || linkedType === "delivery_challan")
    return "delivery_challan";
  if (
    template === "gold_settlement_reminder" ||
    template === "settlement_ready" ||
    template === "pending_settlement" ||
    linkedType === "gold_settlement"
  )
    return "gold_settlement";
  if (template === "business_report") return "business_report";
  if (
    template === "invoice" ||
    template === "receipt" ||
    template === "estimate" ||
    template === "advance_receipt" ||
    template === "payment_reminder" ||
    linkedType === "invoice"
  )
    return "invoice";
  if (
    template === "order_confirmation" ||
    template === "order_ready" ||
    template === "order_delivered" ||
    linkedType === "order"
  )
    return "order";
  if (template === "repair_ready" || linkedType === "repair") return "repair";
  if (template === "manufacturing_bill" || linkedType === "job") return "manufacturing_bill";
  return null;
}

function resolveDocumentRecord(req: CommRequest): any {
  const { linkedType, linkedId } = req;
  if (!linkedId) return null;
  if (linkedType === "invoice" || linkedType === "estimate") {
    return useBilling.getState().invoices.find((i) => i.id === linkedId) ?? null;
  }
  if (linkedType === "order") {
    return useOrders.getState().orders.find((o) => o.id === linkedId) ?? null;
  }
  if (linkedType === "repair") {
    return useRepairs.getState().repairs.find((r) => r.id === linkedId) ?? null;
  }
  if (linkedType === "job") {
    const s = useMfgBills.getState() as any;
    const list: any[] = s.bills ?? s.mfgBills ?? s.items ?? [];
    return list.find((b: any) => b.id === linkedId) ?? null;
  }
  if (linkedType === "delivery_challan" || req.template === "delivery_challan") {
    return useDeliveryChallans.getState().challans.find((c) => c.id === linkedId) ?? null;
  }
  if (linkedType === "gold_settlement" || req.template.includes("settlement")) {
    return useGoldSettlement.getState().settlements.find((s) => s.id === linkedId) ?? null;
  }
  return null;
}

export class WhatsAppWasenderProvider implements CommProvider {
  readonly name = "WhatsApp (WasenderAPI)";
  readonly capabilities = {
    channels: ["whatsapp"] as const,
    templates: [
      "invoice",
      "receipt",
      "estimate",
      "advance_receipt",
      "payment_reminder",
      "order_ready",
      "repair_ready",
      "job_assignment",
      "manufacturing_bill",
      "order_confirmation",
      "order_delivered",
      "gold_settlement_reminder",
      "settlement_ready",
      "pending_settlement",
      "business_report",
      "otp",
      "promotional",
      "custom",
    ] as const,
    isApiDelivery: true,
  };

  private config: ProviderConfig | null = null;

  configure(config: ProviderConfig) {
    this.config = config;
    const base = config.settings[WHATSAPP_KEYS.apiBaseUrl];
    if (base) wasenderClient.setBaseUrl(base);
  }

  private fail(error: string, diagnostics?: Record<string, unknown>): CommResult {
    if (diagnostics) {
      console.error(`[WasenderAPI Delivery Failure] ${error}`, diagnostics);
    }
    return { success: false, provider: this.name, channel: "whatsapp", error, status: "failed" };
  }

  async send(req: CommRequest, content: ResolvedContent): Promise<CommResult> {
    if (!isWasenderBridgeAvailable()) return this.fail("WhatsApp cloud provider unavailable");
    if (!this.config) return this.fail("WasenderAPI Provider not configured in settings");

    const phone = cleanPhone(req.recipient.phone);
    if (!phone) return this.fail("No valid recipient phone number provided");

    try {
      const pdfType = templateToPdfType(req.template, req.linkedType);
      const record = resolveDocumentRecord(req);
      let documentBlob: Blob | null = null;
      let documentFileName = `${req.template}-${req.linkedId || Date.now()}.pdf`;

      if (pdfType && record) {
        try {
          const firm = useSettings.getState().firm;
          const pdfRes = await generateDocumentPdf(pdfType, record, firm);
          documentBlob = pdfRes.blob;
          documentFileName = pdfRes.fileName;
        } catch (genErr: any) {
          console.warn(
            "[WasenderAPI] PDF generation failed for document, falling back to text:",
            genErr,
          );
        }
      }

      // If document Blob exists, run the 7-step document pipeline
      if (documentBlob && documentBlob.size > 0) {
        // Step 1 & 2: Generate & verify Blob exists
        console.log(
          `[WasenderAPI Pipeline] PDF verified: ${documentFileName} (${documentBlob.size} bytes)`,
        );

        // Step 3 & 4: Upload Media & Retrieve public URL
        const uploadRes = await wasenderClient.uploadMedia(
          documentBlob,
          documentFileName,
          "application/pdf",
        );
        if (!uploadRes.ok || !uploadRes.url) {
          return this.fail(`Media Upload failed: ${uploadRes.error || "No public URL returned"}`, {
            requestUrl: uploadRes.raw ? (uploadRes.raw as any).requestUrl : "POST /upload",
            httpStatus: uploadRes.status,
            responseBody: uploadRes.raw,
            validationErrors: (uploadRes.raw as any)?.errors || (uploadRes.raw as any)?.validation,
          });
        }

        const publicUrl = uploadRes.url;
        if (!publicUrl.startsWith("http://") && !publicUrl.startsWith("https://")) {
          return this.fail("Upload returned invalid non-HTTP URL — local paths are prohibited", {
            uploadUrl: publicUrl,
          });
        }
        console.log(
          `[WasenderAPI Pipeline] Media uploaded successfully -> Public URL: ${publicUrl}`,
        );

        // Step 5 & 6: Send Document & Verify delivery
        const sendRes = await wasenderClient.sendDocument(
          phone,
          publicUrl,
          documentFileName,
          content.textBody ?? "",
        );

        if (!sendRes.ok) {
          return this.fail(`Send Document failed: ${sendRes.error || `HTTP ${sendRes.status}`}`, {
            requestUrl: "POST /send-message",
            httpStatus: sendRes.status,
            responseBody: sendRes.data,
            uploadUrl: publicUrl,
            validationErrors: (sendRes.data as any)?.errors,
          });
        }

        const messageId = msgId(sendRes.data);
        console.log(
          `[WasenderAPI Pipeline] Document delivered successfully. Message ID: ${messageId}`,
        );
        return {
          success: true,
          provider: this.name,
          channel: "whatsapp",
          messageId,
          status: "sent",
        };
      }

      // Fallback: Send text message directly
      const sendRes = await wasenderClient.sendText(phone, content.textBody ?? "");
      if (!sendRes.ok) {
        return this.fail(`Send Text failed: ${sendRes.error || `HTTP ${sendRes.status}`}`, {
          requestUrl: "POST /send-message",
          httpStatus: sendRes.status,
          responseBody: sendRes.data,
          validationErrors: (sendRes.data as any)?.errors,
        });
      }

      const messageId = msgId(sendRes.data);
      return {
        success: true,
        provider: this.name,
        channel: "whatsapp",
        messageId,
        status: "sent",
      };
    } catch (err) {
      return this.fail(err instanceof Error ? err.message : String(err), {
        errorObject: err,
      });
    }
  }
}

/** Pull a message id out of WasenderAPI's response shape (best-effort). */
function msgId(data: unknown): string | undefined {
  const o = data as Record<string, unknown> | null;
  const id =
    o?.id ??
    o?.messageId ??
    (o?.data as { id?: unknown })?.id ??
    (o?.data as { messageId?: unknown })?.messageId;
  return id != null ? String(id) : undefined;
}
