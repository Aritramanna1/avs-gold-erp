/**
 * MTJ Communication Service — the ONLY entry point for sending messages.
 *
 * BillingModule usage:
 *   import { commService } from "@/lib/comm/service";
 *   await commService.send({ channel: "whatsapp", template: "invoice", ... });
 *
 * To switch providers: change settings in CommSettings UI — no code changes needed.
 */
import type { CommRequest, CommResult, CommChannel } from "./types";
import { buildContent } from "./content-builder";
import { createProvider } from "./provider-registry";
import { useCommSettings } from "./comm-settings-store";
import { useCommLog } from "@/lib/comm-log-store";
import { getOrCreateDocumentPdfUrl } from "@/lib/document-pdf-service";
import { createDocumentShareLink, linkedTypeToShareDocType } from "@/lib/document-shares";
import { resolvePrintDocTypeFromComm } from "@/lib/comm-print-resolver";
import { withRateLimit } from "./fetch-with-timeout";
import { toast } from "sonner";
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export interface SendOptions {
  /** Set by comm-queue.ts when replaying a queued retry — prevents a retry-of-a-retry
   *  from re-enqueuing itself into the same queue it was just drained from. */
  skipQueueOnFailure?: boolean;
}

class CommunicationService {
  /**
   * Send a message through the configured provider for the given channel.
   * Falls back through providers by priority if the first one fails. If
   * every configured provider fails, the request is durably queued for
   * background retry (see comm-queue.ts) rather than simply discarded —
   * unless `opts.skipQueueOnFailure` is set (used by the queue's own drain
   * loop to avoid re-queuing a retry that itself failed).
   */
  async send(req: CommRequest, opts: SendOptions = {}): Promise<CommResult> {
    // Business rule toggles (business-rules-store.ts) — checked here,
    // ahead of everything else, so "Enable Email"/"Enable WhatsApp" are
    // real master switches rather than settings that only affect which
    // provider gets picked. Deliberately a silent no-op rather than a
    // thrown error: a disabled channel isn't a failure, it's "off."
    const { useBusinessRules } = await import("@/lib/business-rules-store");
    const rules = useBusinessRules.getState();
    if (req.channel === "email" && !rules.isEnabled("enable_email")) {
      return {
        success: false,
        provider: "none",
        channel: req.channel,
        error: "Email is disabled (Settings)",
        status: "failed",
      };
    }
    if (req.channel === "whatsapp" && !rules.isEnabled("enable_whatsapp")) {
      return {
        success: false,
        provider: "none",
        channel: req.channel,
        error: "WhatsApp is disabled (Settings)",
        status: "failed",
      };
    }

    let configs: any[] = [];
    if (req.channel === "whatsapp") {
      const { activeWhatsAppProvider } = await import("./send-whatsapp-text");
      const providerType = activeWhatsAppProvider(req.branchId);
      if (!providerType) {
        return {
          success: false,
          provider: "none",
          channel: req.channel,
          error: "WhatsApp is disabled (Settings)",
          status: "failed",
        };
      }
      if (providerType === "whatsapp_wasender") {
        const wasenderConfig = useCommSettings.getState().getWasenderConfig(req.branchId || "MAIN");
        configs = wasenderConfig && wasenderConfig.isActive ? [wasenderConfig] : [];
      } else {
        const { useWaAutomation } = await import("@/lib/wa-automation-store");
        const waConfig = useWaAutomation.getState().getConfig(req.branchId || "MAIN");
        if (!waConfig.enabled || waConfig.providerType === "whatsapp_deep_link") {
          configs = [];
        } else {
          configs = [
            {
              id: "wa_automation",
              branchId: req.branchId || "MAIN",
              channel: "whatsapp",
              providerType,
              isActive: true,
              priority: 0,
              settings: {},
            },
          ];
        }
      }
    } else {
      configs = useCommSettings.getState().getActiveProviders(req.branchId, req.channel);
    }

    if (configs.length === 0) {
      // Graceful fallback: if no provider configured for this channel, warn
      const msg = `No active ${req.channel} provider configured for branch ${req.branchId}`;
      toast.warning(`Communication: ${msg}`);
      return {
        success: false,
        provider: "none",
        channel: req.channel,
        error: msg,
        status: "failed",
      };
    }

    // Generate customer portal share link (non-blocking — fails silently)
    const shareUrl = req.linkedId
      ? await createDocumentShareLink(
          linkedTypeToShareDocType(req.linkedType),
          req.linkedId,
          req.branchId,
        )
      : null;

    // Generate PDF and upload (non-blocking — falls back to null if Hostinger not configured)
    // Resolve shop-parity print doc type for logging / future PrintEngine routing.
    const printDocType = resolvePrintDocTypeFromComm({
      template: req.template,
      linkedType: req.linkedType,
    });
    if (printDocType) {
      (req as CommRequest & { resolvedPrintDocType?: string }).resolvedPrintDocType = printDocType;
    }
    const pdfUrl = await getOrCreateDocumentPdfUrl(req);

    const content = await buildContent(req);
    if (shareUrl) {
      content.shareUrl = shareUrl;
      // Portal URL is the primary customer-facing link
      content.attachmentUrls = [shareUrl, ...(content.attachmentUrls ?? [])];
    }
    if (pdfUrl) {
      content.pdfUrl = pdfUrl;
    }

    for (const config of configs) {
      try {
        if (req.channel === "whatsapp" && config.providerType !== "whatsapp_deep_link") {
          const { data: edgeResult, error: edgeError } = await (supabase as any).functions.invoke(
            "send-whatsapp",
            {
              body: {
                branchId: req.branchId || "MAIN",
                phone: req.recipient.phone,
                message: content.textBody || `${req.template} notification`,
              },
            },
          );
          const result: CommResult = {
            success: !edgeError && edgeResult?.ok === true,
            provider: config.providerType,
            channel: req.channel,
            messageId: edgeResult?.messageId,
            error: edgeError?.message || edgeResult?.error,
            status: edgeError || edgeResult?.ok !== true ? "failed" : "queued",
          };
          this.log(req, result, content.textBody ?? "");
          if (result.success) return result;
          continue;
        }

        if (req.channel === "email" && config.providerType.startsWith("email_")) {
          let emailSuccess = false;
          let emailError: string | undefined;
          try {
            const res = await fetch("/api/email/send.php", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                branchId: req.branchId || "MAIN",
                to: req.recipient.email,
                subject: content.subject,
                htmlBody: content.htmlBody,
                textBody: content.textBody,
              }),
            });
            const data = await res.json().catch(() => ({}));
            emailSuccess = res.ok && data.success !== false;
            if (!emailSuccess) emailError = data.error || `HTTP ${res.status}`;
          } catch (e: any) {
            emailError = e?.message || "Email dispatch failed";
          }

          const result: CommResult = {
            success: emailSuccess,
            provider: config.providerType,
            channel: req.channel,
            error: emailError,
            status: emailSuccess ? "queued" : "failed",
          };
          this.log(req, result, content.textBody ?? "");
          if (result.success) return result;
          continue;
        }

        if (config.providerType === "whatsapp_deep_link") {
          const provider = createProvider(config.providerType);
          provider.configure(config);
          const result = await withRateLimit(req.channel, () => provider.send(req, content));
          this.log(req, result, content.textBody ?? "");
          if (result.success) return result;
          continue;
        }

        console.warn(
          `[CommService] Skipping client-side provider ${config.providerType} — use edge relay.`,
        );
      } catch (err: unknown) {
        console.error(`[CommService] Provider ${config.providerType} threw:`, err);
      }
    }

    const fallbackResult: CommResult = {
      success: false,
      provider: "all_failed",
      channel: req.channel,
      error: "All configured providers failed",
      status: "failed",
    };
    const logEvent = this.log(req, fallbackResult, "");

    if (!opts.skipQueueOnFailure) {
      const { enqueueForRetry } = await import("./comm-queue");
      await enqueueForRetry(req, logEvent?.id).catch((err) =>
        console.error("[CommService] Failed to enqueue for retry:", err),
      );
      toast.error(
        `Failed to send ${req.template} via ${req.channel} — saved to communication_jobs for retry`,
      );
    } else {
      toast.error(`Retry failed: ${req.template} via ${req.channel}`);
    }
    return fallbackResult;
  }

  /** Shorthand: send invoice via a specific channel */
  async sendInvoice(
    invoiceId: string,
    branchId: string,
    channel: CommChannel,
    recipientName: string,
    contact: { phone?: string; email?: string },
  ): Promise<CommResult> {
    return this.send({
      channel,
      template: "invoice",
      branchId,
      recipient: { name: recipientName, ...contact },
      linkedId: invoiceId,
      linkedType: "invoice",
    });
  }

  /** Shorthand: send payment reminder */
  async sendPaymentReminder(
    invoiceId: string,
    branchId: string,
    channel: CommChannel,
    recipientName: string,
    contact: { phone?: string; email?: string },
  ): Promise<CommResult> {
    return this.send({
      channel,
      template: "payment_reminder",
      branchId,
      recipient: { name: recipientName, ...contact },
      linkedId: invoiceId,
      linkedType: "invoice",
    });
  }

  /** Shorthand: notify order ready */
  async notifyOrderReady(
    orderId: string,
    branchId: string,
    channel: CommChannel,
    recipientName: string,
    phone?: string,
  ): Promise<CommResult> {
    return this.send({
      channel,
      template: "order_ready",
      branchId,
      recipient: { name: recipientName, phone },
      linkedId: orderId,
      linkedType: "order",
    });
  }

  private log(req: CommRequest, result: CommResult, body: string) {
    try {
      const event = useCommLog.getState().record({
        kind:
          result.status === "deep_link_opened"
            ? "opened_app"
            : result.success
              ? "manually_sent"
              : "prepared",
        templateKind: req.template as import("@/lib/wa-templates-store").TemplateKind,
        templateName: req.template,
        target: "customer",
        recipientLabel: req.recipient.name,
        recipientPhone: req.recipient.phone ?? req.recipient.email ?? "",
        linkedType: req.linkedType,
        linkedId: req.linkedId,
        body: body || `${req.template} via ${result.provider} — ${result.status ?? "unknown"}`,
        deliveryStatus: result.status,
      });

      // The comm log (above) and the security audit trail are two
      // different systems with two different audiences — this was
      // previously comm-log-only, meaning a communication send left no
      // trace in the same audit trail ledger reversals/settlements/
      // barcode generation all use. Best-effort so a logging failure can
      // never block or fail an otherwise-successful send.
      import("@/lib/security/audit-log").then(({ append }) => {
        import("@/lib/providers/data-provider").then(({ supabase: sb }) => {
          sb.auth.getSession().then(({ data }) => {
            append({
              actorId: data.session?.user.id ?? null,
              actorEmail: data.session?.user.email ?? null,
              action: `communication.${req.channel}.${result.success ? "sent" : "failed"}`,
              entityType: "communication",
              entityId: event.id,
              before: null,
              after: {
                channel: req.channel,
                template: req.template,
                linkedType: req.linkedType,
                linkedId: req.linkedId,
                provider: result.provider,
                status: result.status,
              },
              deviceId: null,
            }).catch((err) => console.error("[CommService] Failed to audit-log send:", err));
          });
        });
      });

      // Automatically post to CRM interaction timeline if we can resolve the customer
      import("@/lib/people-store").then(({ usePeople }) => {
        const cleanPhone = (req.recipient.phone || "").replace(/\D/g, "").slice(-10);
        const person = usePeople
          .getState()
          .people.find((p) => p.phone.replace(/\D/g, "").slice(-10) === cleanPhone);
        if (person) {
          import("@/lib/crm-store").then(({ useCRMStore }) => {
            useCRMStore
              .getState()
              .addInteraction({
                branchId: req.branchId,
                personId: person.id,
                type:
                  req.channel === "whatsapp"
                    ? "whatsapp"
                    : req.channel === "email"
                      ? "email"
                      : "sms",
                title: `Outbound ${req.channel.toUpperCase()} — ${req.template.toUpperCase()}`,
                body: body || `${req.template} sent successfully via ${result.provider}`,
                data: { req, result },
              })
              .catch(() => {});
          });
        }
      });

      return event;
    } catch {
      /* log failures must never break the main flow */
      return null;
    }
  }
}

export const commService = new CommunicationService();
