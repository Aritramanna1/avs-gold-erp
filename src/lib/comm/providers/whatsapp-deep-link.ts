import type {
  CommProvider,
  CommRequest,
  CommResult,
  ProviderConfig,
  ResolvedContent,
} from "../types";
import { cleanPhone, isValidWaPhone, waMobileUrl } from "@/lib/wa-link";

export class WhatsAppDeepLinkProvider implements CommProvider {
  readonly name = "WhatsApp Deep Link";
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
    ] as const,
    isApiDelivery: false,
  };

  configure(_config: ProviderConfig) {
    /* no credentials needed */
  }

  async send(req: CommRequest, content: ResolvedContent): Promise<CommResult> {
    const phone = req.recipient.phone;
    if (!phone || !isValidWaPhone(phone)) {
      return {
        success: false,
        provider: this.name,
        channel: "whatsapp",
        error: "Invalid or missing phone number",
        status: "failed",
      };
    }

    // Prefer customer portal URL (mobile-friendly, no login) over direct PDF link
    const documentUrl = content.shareUrl ?? content.pdfUrl ?? content.attachmentUrls?.[0];
    const messageBody = content.textBody ?? `Message from MTJ ERP (${req.template})`;
    const message = documentUrl ? `${messageBody}\n\nDocument: ${documentUrl}` : messageBody;
    const url = waMobileUrl(phone, message);

    // Open deep link — user must confirm the send in WhatsApp
    window.open(url, "_blank");

    return {
      success: true,
      provider: this.name,
      channel: "whatsapp",
      status: "deep_link_opened",
      deepLinkUrl: url,
    };
  }
}
