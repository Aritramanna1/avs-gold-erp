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
import { toast } from "sonner";

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
    const configs = useCommSettings.getState().getActiveProviders(req.branchId, req.channel);

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
        const provider = createProvider(config.providerType);
        provider.configure(config);
        const result = await provider.send(req, content);

        this.log(req, result, content.textBody ?? "");

        if (result.success) return result;

        // Provider failed — try next in priority order
        console.warn(`[CommService] ${config.providerType} failed:`, result.error, "— trying next");
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
      toast.error(`Failed to send ${req.template} via ${req.channel} — queued for automatic retry`);
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
