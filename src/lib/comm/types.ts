/**
 * MTJ ERP — Communication Layer Types
 * Provider-agnostic interfaces for Email, WhatsApp, SMS.
 * Adding a new provider = implement CommProvider, register in provider-registry.ts.
 */

// ── Message channel ──────────────────────────────────────────────────────────
export type CommChannel = "email" | "whatsapp" | "sms";

// ── Template kinds ────────────────────────────────────────────────────────────
export type MessageTemplate =
  | "invoice"
  | "receipt"
  | "estimate"
  | "advance_receipt"
  | "payment_reminder"
  | "order_ready"
  | "repair_ready"
  | "job_assignment"
  | "otp"
  | "promotional"
  | "manufacturing_bill"
  | "order_confirmation"
  | "order_delivered"
  | "gold_settlement_reminder"
  | "business_report"
  | "settlement_ready"
  | "pending_settlement";

// ── Send request ─────────────────────────────────────────────────────────────
export interface CommRequest {
  channel: CommChannel;
  template: MessageTemplate;
  /** Branch the communication originates from */
  branchId: string;
  recipient: {
    name: string;
    phone?: string;
    email?: string;
  };
  /** The document being communicated */
  linkedId: string;
  linkedType: "invoice" | "order" | "job" | "repair" | "estimate";
  /** Arbitrary key-value pairs injected into template variables */
  variables?: Record<string, string | number>;
}

// ── Send result ───────────────────────────────────────────────────────────────
export interface CommResult {
  success: boolean;
  provider: string;
  channel: CommChannel;
  messageId?: string;
  error?: string;
  /** Delivery status from API (if available immediately) */
  status?: "queued" | "sent" | "delivered" | "failed" | "deep_link_opened";
  /** For deep-link providers — the URL to open */
  deepLinkUrl?: string;
}

// ── Provider capability declaration ──────────────────────────────────────────
export interface ProviderCapabilities {
  channels: readonly CommChannel[];
  templates: readonly MessageTemplate[];
  /** Provider can actually deliver (vs just building a deep link) */
  isApiDelivery: boolean;
}

// ── Provider interface — every provider must implement this ───────────────────
export interface CommProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;
  /** Called once with settings when the provider is activated */
  configure(config: ProviderConfig): void;
  /** Send a message — returns result (never throws) */
  send(req: CommRequest, content: ResolvedContent): Promise<CommResult>;
}

// ── Resolved content (built by content-builder before provider is called) ─────
export interface ResolvedContent {
  subject?: string; // Email subject
  htmlBody?: string; // Email HTML
  textBody?: string; // Plain-text fallback / WhatsApp message body
  templateName?: string; // BSP template name (for approved WA templates)
  templateParams?: string[]; // Positional params for BSP templates
  attachmentUrls?: string[]; // Public document URLs (Hostinger or ERP print)
  pdfUrl?: string; // Direct PDF file URL (Hostinger/Supabase storage)
  shareUrl?: string; // Customer portal URL: /doc/{token} — preferred for customer sharing
}

// ── Provider configuration (stored in Supabase comm_provider_settings table) ──
export interface ProviderConfig {
  id: string;
  branchId: string;
  channel: CommChannel;
  providerType: ProviderType;
  isActive: boolean;
  priority: number; // Lower = try first (0 = primary)
  // Generic credential bag — each provider reads what it needs
  settings: Record<string, string>;
}

export type ProviderType =
  // Email
  | "email_smtp"
  | "email_resend"
  | "email_sendgrid"
  | "email_ses"
  | "email_mailgun"
  // WhatsApp
  | "whatsapp_deep_link"
  | "whatsapp_cloud_api" // Meta Cloud API
  | "whatsapp_openwa" // Self-hosted OpenWA (open-wa/wa-automate) server
  | "whatsapp_interakt"
  | "whatsapp_wati"
  | "whatsapp_aisensy"
  | "whatsapp_gupshup"
  // SMS (future)
  | "sms_twilio"
  | "sms_msg91"
  | "sms_fast2sms";

// ── Well-known setting keys (type-safe access helpers) ────────────────────────
export const EMAIL_KEYS = {
  host: "host",
  port: "port",
  username: "username",
  password: "password",
  fromEmail: "from_email",
  fromName: "from_name",
  replyTo: "reply_to",
  useSsl: "use_ssl",
  encryption: "encryption",
  apiKey: "api_key",
} as const;

export const WHATSAPP_KEYS = {
  phoneNumberId: "phone_number_id",
  accessToken: "access_token",
  businessAccountId: "business_account_id",
  webhookVerifyToken: "webhook_verify_token",
  webhookUrl: "webhook_url",
  apiBaseUrl: "api_base_url",
  apiVersion: "api_version",
  templateLanguage: "template_language",
  // BSP keys
  apiKey: "api_key",
  apiUrl: "api_url",
  senderPhone: "sender_phone",
  // Template names per message type
  templateInvoice: "template_invoice",
  templateReceipt: "template_receipt",
  templateEstimate: "template_estimate",
  templateOrderReady: "template_order_ready",
  templateRepairReady: "template_repair_ready",
  templatePaymentReminder: "template_payment_reminder",
  templateOtp: "template_otp",
} as const;
