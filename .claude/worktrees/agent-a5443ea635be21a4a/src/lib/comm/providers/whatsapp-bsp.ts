/**
 * Generic BSP (Business Solution Provider) WhatsApp provider.
 * Supports Interakt, WATI, AiSensy, Gupshup — each has a similar REST API shape.
 * Configured by: providerType, api_url, api_key, sender_phone, template_* names.
 */
import type {
  CommProvider,
  CommRequest,
  CommResult,
  ProviderConfig,
  ResolvedContent,
  ProviderType,
} from "../types";
import { WHATSAPP_KEYS } from "../types";
import { cleanPhone } from "@/lib/wa-link";

const BSP_CONFIGS: Record<string, { defaultApiUrl: string; authHeader: (key: string) => string }> =
  {
    whatsapp_interakt: {
      defaultApiUrl: "https://api.interakt.ai/v1/public/message/",
      authHeader: (key) => `Basic ${key}`,
    },
    whatsapp_wati: {
      defaultApiUrl: "https://live-server.wati.io/api/v1/sendTemplateMessage",
      authHeader: (key) => `Bearer ${key}`,
    },
    whatsapp_aisensy: {
      defaultApiUrl: "https://backend.aisensy.com/campaign/t1/api",
      authHeader: (key) => `Bearer ${key}`,
    },
    whatsapp_gupshup: {
      defaultApiUrl: "https://api.gupshup.io/sm/api/v1/template/msg",
      authHeader: (key) => `${key}`,
    },
  };

export class WhatsAppBspProvider implements CommProvider {
  readonly name: string;
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
      "otp",
      "promotional",
    ] as const,
    isApiDelivery: true,
  };

  private config: ProviderConfig | null = null;
  private providerType: ProviderType;

  constructor(providerType: ProviderType) {
    this.providerType = providerType;
    const label = providerType.replace("whatsapp_", "").toUpperCase();
    this.name = `WhatsApp ${label}`;
  }

  configure(config: ProviderConfig) {
    this.config = config;
  }

  async send(req: CommRequest, content: ResolvedContent): Promise<CommResult> {
    if (!this.config) {
      return {
        success: false,
        provider: this.name,
        channel: "whatsapp",
        error: "Not configured",
        status: "failed",
      };
    }

    const s = this.config.settings;
    const apiKey = s[WHATSAPP_KEYS.apiKey];
    const bspConf = BSP_CONFIGS[this.providerType];
    const apiUrl = s[WHATSAPP_KEYS.apiUrl] || bspConf?.defaultApiUrl;

    if (!apiKey || !apiUrl) {
      return {
        success: false,
        provider: this.name,
        channel: "whatsapp",
        error: "api_key or api_url not set",
        status: "failed",
      };
    }

    const to = cleanPhone(req.recipient.phone);
    const templateName = s[`template_${req.template}`] ?? "invoice_notification";
    const params = content.templateParams ?? [];

    // Each BSP has a slightly different body shape — normalised here
    const body = {
      to,
      type: "template",
      template: { name: templateName, languageCode: "en_IN" },
      params,
      message: content.textBody,
    };

    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: bspConf?.authHeader(apiKey) ?? `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        return {
          success: false,
          provider: this.name,
          channel: "whatsapp",
          error: `HTTP ${res.status}: ${err}`,
          status: "failed",
        };
      }

      return { success: true, provider: this.name, channel: "whatsapp", status: "queued" };
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
