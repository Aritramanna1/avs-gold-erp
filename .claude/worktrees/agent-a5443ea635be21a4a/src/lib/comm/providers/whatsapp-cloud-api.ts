/**
 * Meta WhatsApp Business Cloud API provider.
 * Activate by setting providerType = "whatsapp_cloud_api" in comm_provider_settings
 * and filling in: phone_number_id, access_token, api_version (default v18.0)
 *
 * Messages are sent as approved template messages (required for business-initiated chats).
 * Template names are configured per-branch in comm_provider_settings.settings.
 */
import type {
  CommProvider,
  CommRequest,
  CommResult,
  ProviderConfig,
  ResolvedContent,
} from "../types";
import { WHATSAPP_KEYS } from "../types";
import { cleanPhone } from "@/lib/wa-link";

export class WhatsAppCloudApiProvider implements CommProvider {
  readonly name = "WhatsApp Cloud API (Meta)";
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
      "otp",
    ] as const,
    isApiDelivery: true,
  };

  private config: ProviderConfig | null = null;

  configure(config: ProviderConfig) {
    this.config = config;
  }

  async send(req: CommRequest, content: ResolvedContent): Promise<CommResult> {
    if (!this.config) {
      return {
        success: false,
        provider: this.name,
        channel: "whatsapp",
        error: "Provider not configured",
        status: "failed",
      };
    }

    const s = this.config.settings;
    const phoneNumberId = s[WHATSAPP_KEYS.phoneNumberId];
    const accessToken = s[WHATSAPP_KEYS.accessToken];
    const apiVersion = s[WHATSAPP_KEYS.apiVersion] || "v18.0";
    const apiBaseUrl = (s[WHATSAPP_KEYS.apiBaseUrl] || "https://graph.facebook.com").replace(
      /\/+$/,
      "",
    );
    const langCode = s[WHATSAPP_KEYS.templateLanguage] || "en_IN";
    const templateName =
      s[`template_${req.template}`] ?? s[WHATSAPP_KEYS.templateInvoice] ?? "invoice_notification";

    if (!phoneNumberId || !accessToken) {
      return {
        success: false,
        provider: this.name,
        channel: "whatsapp",
        error: "phone_number_id or access_token not set",
        status: "failed",
      };
    }

    const to = cleanPhone(req.recipient.phone);
    if (!to) {
      return {
        success: false,
        provider: this.name,
        channel: "whatsapp",
        error: "No valid phone number",
        status: "failed",
      };
    }

    const apiUrl = `${apiBaseUrl}/${apiVersion}/${phoneNumberId}/messages`;
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    try {
      // If a public PDF URL is available, send it as a document message first
      if (content.pdfUrl) {
        const docPayload = {
          messaging_product: "whatsapp",
          to,
          type: "document",
          document: {
            link: content.pdfUrl,
            caption:
              content.textBody ??
              `Document from ${s[WHATSAPP_KEYS.templateLanguage] ? req.template : req.template}`,
            filename: content.pdfUrl.split("/").pop() ?? "document.pdf",
          },
        };

        const docRes = await fetch(apiUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(docPayload),
        });
        const docData = await docRes.json();

        if (docRes.ok) {
          return {
            success: true,
            provider: this.name,
            channel: "whatsapp",
            messageId: docData?.messages?.[0]?.id,
            status: "queued",
          };
        }
        // Document send failed — fall through to template message
        console.warn(
          "[WhatsApp Cloud API] Document send failed, falling back to template:",
          docData?.error?.message,
        );
      }

      // Send approved template message (standard flow / fallback)
      const params = content.templateParams ?? [];
      const components: any[] =
        params.length > 0
          ? [{ type: "body", parameters: params.map((v) => ({ type: "text", text: String(v) })) }]
          : [];

      // If PDF URL exists but document send failed, append URL as a text button component
      if (content.pdfUrl && components.length === 0) {
        components.push({
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [{ type: "text", text: content.pdfUrl }],
        });
      }

      const templatePayload = {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: langCode },
          components,
        },
      };

      const res = await fetch(apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(templatePayload),
      });
      const data = await res.json();

      if (!res.ok) {
        return {
          success: false,
          provider: this.name,
          channel: "whatsapp",
          error: data?.error?.message ?? `HTTP ${res.status}`,
          status: "failed",
        };
      }

      return {
        success: true,
        provider: this.name,
        channel: "whatsapp",
        messageId: data?.messages?.[0]?.id,
        status: "queued",
      };
    } catch (err: unknown) {
      return {
        success: false,
        provider: this.name,
        channel: "whatsapp",
        error: err instanceof Error ? err.message : String(err),
        status: "failed",
      };
    }
  }
}
