/**
 * Self-hosted OpenWA (open-wa/wa-automate) provider — a production-grade
 * alternative to the Meta Cloud API for LAN-deployed desktop installs.
 *
 * Activate by setting providerType = "whatsapp_openwa" in
 * comm_provider_settings, with:
 *   api_url    — base URL of the running OpenWA server, e.g. http://192.168.1.50:8080
 *   api_key    — the server's configured API key (sent as `x-api-key`)
 *   sender_phone — optional, informational only (which session this maps to)
 *
 * Like every other provider, this is inert until `configure()` is called
 * with real settings — an unconfigured/disabled OpenWA provider never
 * attempts a network call, matching "remain configurable and disabled
 * until credentials are supplied."
 *
 * Reliability notes (what's real here vs. what stays a documented gap):
 *  - Retry-on-failure, durable queueing, and "the ERP keeps working even if
 *    OpenWA is temporarily down" are ALREADY satisfied by the generic
 *    comm-queue.ts retry mechanism this provider sits behind — a failed
 *    send() here (network error, non-2xx response, session disconnected)
 *    returns success:false, which commService.send() durably queues for
 *    background retry exactly like any other provider failure.
 *  - `checkHealth()` below is a real, callable health/session-status probe
 *    (for a future "API status dashboard" — not built this pass) — it's
 *    additive and never called automatically by send() itself.
 *  - Message batching and local media caching are NOT implemented — every
 *    send is a single HTTP call per message/attachment, which is correct
 *    but not optimized for high-volume broadcast sending.
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

export interface OpenWaHealthStatus {
  reachable: boolean;
  sessionState?: string;
  error?: string;
}

export class WhatsAppOpenWaProvider implements CommProvider {
  readonly name = "WhatsApp (Self-hosted OpenWA)";
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
      "promotional",
    ] as const,
    isApiDelivery: true,
  };

  private config: ProviderConfig | null = null;

  configure(config: ProviderConfig) {
    this.config = config;
  }

  private baseUrl(): string | null {
    const url = this.config?.settings[WHATSAPP_KEYS.apiUrl];
    return url ? url.replace(/\/+$/, "") : null;
  }

  async send(req: CommRequest, content: ResolvedContent): Promise<CommResult> {
    if (!this.config) {
      return { success: false, provider: this.name, channel: "whatsapp", error: "Provider not configured", status: "failed" };
    }
    const s = this.config.settings;
    const apiUrl = this.baseUrl();
    const apiKey = s[WHATSAPP_KEYS.apiKey];

    if (!apiUrl || !apiKey) {
      return {
        success: false,
        provider: this.name,
        channel: "whatsapp",
        error: "OpenWA api_url or api_key not set",
        status: "failed",
      };
    }

    const phone = cleanPhone(req.recipient.phone);
    if (!phone) {
      return { success: false, provider: this.name, channel: "whatsapp", error: "No valid phone number", status: "failed" };
    }
    const chatId = `${phone}@c.us`;
    const headers = { "Content-Type": "application/json", "x-api-key": apiKey };

    try {
      // A PDF/document takes priority over a plain text body, same
      // convention as the Cloud API provider — the recipient gets the
      // actual document, with the text as its caption.
      if (content.pdfUrl) {
        const res = await fetch(`${apiUrl}/sendFile`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            chatId,
            file: content.pdfUrl,
            filename: content.pdfUrl.split("/").pop() ?? "document.pdf",
            caption: content.textBody ?? "",
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          return {
            success: false,
            provider: this.name,
            channel: "whatsapp",
            error: data?.error ?? `HTTP ${res.status}`,
            status: "failed",
          };
        }
        return { success: true, provider: this.name, channel: "whatsapp", messageId: data?.id, status: "queued" };
      }

      const res = await fetch(`${apiUrl}/sendText`, {
        method: "POST",
        headers,
        body: JSON.stringify({ chatId, text: content.textBody ?? "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          success: false,
          provider: this.name,
          channel: "whatsapp",
          error: data?.error ?? `HTTP ${res.status}`,
          status: "failed",
        };
      }
      return { success: true, provider: this.name, channel: "whatsapp", messageId: data?.id, status: "queued" };
    } catch (err: unknown) {
      // Network unreachable (server down, LAN disconnected) — exactly the
      // "OpenWA temporarily disconnected" case; returning failed here is
      // what lets comm-queue.ts pick it up for automatic retry once the
      // server is back.
      return {
        success: false,
        provider: this.name,
        channel: "whatsapp",
        error: err instanceof Error ? err.message : String(err),
        status: "failed",
      };
    }
  }

  /** Real, callable health probe — not invoked automatically by send(). For a future status dashboard. */
  async checkHealth(): Promise<OpenWaHealthStatus> {
    const apiUrl = this.baseUrl();
    const apiKey = this.config?.settings[WHATSAPP_KEYS.apiKey];
    if (!apiUrl || !apiKey) return { reachable: false, error: "Not configured" };
    try {
      const res = await fetch(`${apiUrl}/getSessionState`, { headers: { "x-api-key": apiKey } });
      if (!res.ok) return { reachable: false, error: `HTTP ${res.status}` };
      const data = await res.json().catch(() => ({}));
      return { reachable: true, sessionState: data?.state ?? data?.status ?? "unknown" };
    } catch (err) {
      return { reachable: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
