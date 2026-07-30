/**
 * Email providers: SMTP, Resend, SendGrid, Amazon SES, Mailgun.
 * All share the same CommProvider interface.
 * Switch between providers by changing providerType in comm_provider_settings.
 */
import type {
  CommProvider,
  CommRequest,
  CommResult,
  ProviderConfig,
  ResolvedContent,
  ProviderType,
} from "../types";
import { EMAIL_KEYS } from "../types";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { extractEdgeFunctionError } from "@/lib/edge-function-error";
import { fetchWithTimeout } from "../fetch-with-timeout";

export class EmailProvider implements CommProvider {
  readonly name: string;
  readonly capabilities = {
    channels: ["email"] as const,
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
  private providerType: ProviderType;

  constructor(providerType: ProviderType) {
    this.providerType = providerType;
    this.name = `Email (${providerType.replace("email_", "").toUpperCase()})`;
  }

  configure(config: ProviderConfig) {
    this.config = config;
  }

  /** Single relay path to the ERP's one email backend (Nodemailer/Hostinger
   *  "send-email" edge function) — used for both SMTP and SES, since SES also
   *  requires server-side AWS4 signing this client can't do directly. */
  private async relayViaSmtpEdgeFunction(
    s: Record<string, string>,
    to: string,
    subject: string,
    html: string,
    defaultHost: string,
    defaultPort: number,
  ): Promise<void> {
    const { error, data } = await supabase.functions.invoke("send-email", {
      body: {
        to,
        subject,
        htmlBody: html,
      },
    });
    if (error) {
      throw new Error(await extractEdgeFunctionError(error, "Email relay error."));
    }
    if (data?.error) {
      throw new Error(data.error);
    }
  }

  async send(req: CommRequest, content: ResolvedContent): Promise<CommResult> {
    if (!this.config) {
      return {
        success: false,
        provider: this.name,
        channel: "email",
        error: "Not configured",
        status: "failed",
      };
    }

    const s = this.config.settings;
    if (["email_resend", "email_sendgrid", "email_mailgun"].includes(this.config.providerType)) {
      return {
        success: false,
        provider: this.name,
        channel: "email",
        error: "This provider requires server-side relay configuration.",
        status: "failed",
      };
    }
    const to = req.recipient.email;

    if (!to) {
      return {
        success: false,
        provider: this.name,
        channel: "email",
        error: "No email address",
        status: "failed",
      };
    }

    const fromEmail = s[EMAIL_KEYS.fromEmail] || "";
    const fromName = s[EMAIL_KEYS.fromName] || "Jewellery ERP";
    const subject = content.subject ?? `Message from ${fromName}`;
    const html = content.htmlBody ?? content.textBody ?? "";

    try {
      switch (this.providerType) {
        case "email_resend": {
          const apiKey = s[EMAIL_KEYS.apiKey];
          if (!apiKey) throw new Error("Resend api_key not set");
          const res = await fetchWithTimeout("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: `${fromName} <${fromEmail}>`, to: [to], subject, html }),
          });
          if (!res.ok) throw new Error(`Resend HTTP ${res.status}`);
          const data = await res.json();
          return {
            success: true,
            provider: this.name,
            channel: "email",
            messageId: data.id,
            status: "queued",
          };
        }

        case "email_sendgrid": {
          const apiKey = s[EMAIL_KEYS.apiKey];
          if (!apiKey) throw new Error("SendGrid api_key not set");
          const res = await fetchWithTimeout("https://api.sendgrid.com/v3/mail/send", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              personalizations: [{ to: [{ email: to }], subject }],
              from: { email: fromEmail, name: fromName },
              content: [{ type: "text/html", value: html }],
            }),
          });
          if (!res.ok) throw new Error(`SendGrid HTTP ${res.status}`);
          return { success: true, provider: this.name, channel: "email", status: "queued" };
        }

        case "email_ses": {
          // Amazon SES requires AWS4 signing this client can't do — relay
          // through the same single email backend as SMTP.
          await this.relayViaSmtpEdgeFunction(
            s,
            to,
            subject,
            html,
            "email.us-east-1.amazonaws.com",
            587,
          );
          return { success: true, provider: this.name, channel: "email", status: "queued" };
        }

        case "email_mailgun": {
          const apiKey = s[EMAIL_KEYS.apiKey];
          const domain = s["domain"] ?? "";
          if (!apiKey) throw new Error("Mailgun api_key not set");
          const form = new FormData();
          form.append("from", `${fromName} <${fromEmail}>`);
          form.append("to", to);
          form.append("subject", subject);
          form.append("html", html);
          const res = await fetchWithTimeout(`https://api.mailgun.net/v3/${domain}/messages`, {
            method: "POST",
            headers: { Authorization: `Basic ${btoa("api:" + apiKey)}` },
            body: form,
          });
          if (!res.ok) throw new Error(`Mailgun HTTP ${res.status}`);
          return { success: true, provider: this.name, channel: "email", status: "queued" };
        }

        default: {
          // SMTP — client can't make raw TCP connections; relay via the ERP's
          // single email backend.
          await this.relayViaSmtpEdgeFunction(s, to, subject, html, "smtp.hostinger.com", 465);
          return { success: true, provider: this.name, channel: "email", status: "queued" };
        }
      }
    } catch (err: unknown) {
      return {
        success: false,
        provider: this.name,
        channel: "email",
        error: err instanceof Error ? err.message : String(err),
        status: "failed",
      };
    }
  }
}
