/**
 * WasenderAPI WhatsApp provider.
 *
 * Delivery goes through the Electron main process (wasender-client → the
 * `mtjDesktop.wasender` bridge), which holds the encrypted token — this
 * provider never sees a credential. A PDF/document takes priority over a plain
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

  private fail(error: string): CommResult {
    return { success: false, provider: this.name, channel: "whatsapp", error, status: "failed" };
  }

  async send(req: CommRequest, content: ResolvedContent): Promise<CommResult> {
    // No desktop bridge (browser build) → cannot reach the secured token →
    // let the service fall through to the deep-link provider.
    if (!isWasenderBridgeAvailable())
      return this.fail("WasenderAPI bridge unavailable (browser build)");
    if (!this.config) return this.fail("Provider not configured");

    const phone = cleanPhone(req.recipient.phone);
    if (!phone) return this.fail("No valid phone number");

    try {
      // Document takes priority — send the real ERP PDF as a WhatsApp document.
      const docUrl = content.pdfUrl ?? content.shareUrl;
      if (docUrl) {
        const fileName = `${req.template}-${req.linkedId}.pdf`;
        const res = await wasenderClient.sendDocument(
          phone,
          docUrl,
          fileName,
          content.textBody ?? "",
        );
        if (!res.ok) return this.fail(res.error ?? `HTTP ${res.status}`);
        return {
          success: true,
          provider: this.name,
          channel: "whatsapp",
          messageId: msgId(res.data),
          status: "sent",
        };
      }

      const res = await wasenderClient.sendText(phone, content.textBody ?? "");
      if (!res.ok) return this.fail(res.error ?? `HTTP ${res.status}`);
      return {
        success: true,
        provider: this.name,
        channel: "whatsapp",
        messageId: msgId(res.data),
        status: "sent",
      };
    } catch (err) {
      return this.fail(err instanceof Error ? err.message : String(err));
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
