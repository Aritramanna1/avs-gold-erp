/**
 * Central Email Service — Supabase-backed async dispatch via send-email edge function.
 * Non-blocking: never rolls back business transactions on email failure.
 */
import {
  renderEmailTemplate,
  type EmailTemplateType,
  type EmailTemplateVariables,
} from "./email-templates";
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export type EmailDeliveryStatus =
  "queued" | "sending" | "sent" | "delivered" | "failed" | "retrying";

export interface SendTemplateEmailOptions {
  maxRetries?: number;
  branchId?: string;
  jobContext?: {
    eventKey?: string;
    referenceType?: string;
    referenceId?: string;
    branchId?: string;
  };
}

export class CentralEmailService {
  public async sendTemplateEmail(
    templateType: EmailTemplateType,
    vars: EmailTemplateVariables,
    options: SendTemplateEmailOptions = {},
  ): Promise<{ success: boolean; emailId: string; error?: string }> {
    const rendered = renderEmailTemplate(templateType, vars);
    const emailId = `eml_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Process async — caller is not blocked
    void this.dispatchEmail(emailId, templateType, rendered, vars, options);

    return { success: true, emailId };
  }

  private async dispatchEmail(
    emailId: string,
    templateType: EmailTemplateType,
    rendered: { subject: string; html: string; text: string },
    vars: EmailTemplateVariables,
    options: SendTemplateEmailOptions,
    attempt = 0,
  ): Promise<void> {
    const maxRetries = options.maxRetries ?? 3;

    try {
      const resp = await fetch("/api/email/send.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: vars.recipientEmail,
          subject: rendered.subject,
          htmlBody: rendered.html,
          textBody: rendered.text,
          branchId: options.branchId ?? options.jobContext?.branchId,
          metadata: {
            emailId,
            templateType,
            eventKey: options.jobContext?.eventKey,
            referenceType: options.jobContext?.referenceType,
            referenceId: options.jobContext?.referenceId,
          },
        }),
      });

      if (!resp.ok) {
        const errorText = await resp.text().catch(() => "");
        throw new Error(errorText || `Hostinger mail error (HTTP ${resp.status})`);
      }

      const data = await resp.json().catch(() => ({ success: true }));
      if (data?.error) throw new Error(String(data.error));

      // Log to email_outbox for delivery tracking in Supabase PostgreSQL
      if (vars.recipientEmail && vars.recipientEmail.includes("@")) {
        void (supabase.from("email_outbox" as never).insert({
          recipient_email: vars.recipientEmail,
          subject: rendered.subject || "Notification",
          template_key: templateType,
          event_key: options.jobContext?.eventKey ?? null,
          entity_type: options.jobContext?.referenceType ?? null,
          entity_id: options.jobContext?.referenceId ?? null,
          status: "sent",
          external_message_id: data?.messageId ?? emailId,
          sent_at: new Date().toISOString(),
        } as never) as any).catch?.(() => {});
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Email delivery failed";
      if (attempt < maxRetries) {
        const delay = Math.min(30_000, 2_000 * 2 ** attempt);
        setTimeout(() => {
          void this.dispatchEmail(emailId, templateType, rendered, vars, options, attempt + 1);
        }, delay);
        return;
      }
      console.error(`[EmailService] Failed after ${maxRetries} retries:`, message);
    }
  }
}

export const centralEmailService = new CentralEmailService();
