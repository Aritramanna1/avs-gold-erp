/**
 * AVS Communication Platform — single entry point for all AVS products.
 *
 * Flow: Product Event → Communication Job → Channel Router → Provider Adapters → Audit
 *
 * Business transactions are NEVER rolled back if messaging fails.
 */
import { commService } from "../service";
import { APP_NAME } from "@/lib/app-info";
import { centralEmailService } from "../email-service";
import type { CommChannel, CommRequest } from "../types";
import {
  DEFAULT_AVS_PRODUCT,
  EVENT_TO_LEGACY_TEMPLATE,
  type DispatchCommunicationEventInput,
  type CommunicationChannel,
  type CommunicationEventKey,
} from "./communication-events";
import { resolveChannelsForEvent, channelSupportsEvent } from "./channel-router";
import {
  createCommunicationJob,
  updateJobStatus,
  recordChannelResult,
} from "./communication-jobs-store";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { eventKeyToEmailTemplate } from "../email-template-catalog";
import { assertCommunicationScope } from "@/lib/portal/portal-context-service";
import { sendSmsViaAdapter } from "./sms-provider-adapter";

export type { DispatchCommunicationEventInput, CommunicationEventKey, CommunicationChannel };

export interface DispatchResult {
  jobId: string | null;
  success: boolean;
  channelsAttempted: CommunicationChannel[];
  channelsSucceeded: CommunicationChannel[];
  errors: string[];
}

function mapEventToCommRequest(
  eventKey: CommunicationEventKey,
  input: DispatchCommunicationEventInput,
  channel: CommChannel,
): CommRequest | null {
  const legacyTemplate = EVENT_TO_LEGACY_TEMPLATE[eventKey];
  if (!legacyTemplate) return null;

  const linkedType = (input.referenceType ?? "invoice") as CommRequest["linkedType"];
  const linkedId = input.referenceId ?? input.payload?.document_id?.toString() ?? "event";

  return {
    channel,
    template: legacyTemplate,
    branchId: input.branchId ?? "MAIN",
    recipient: {
      name: input.recipient.name,
      phone: input.recipient.phone,
      email: input.recipient.email,
    },
    linkedId,
    linkedType: linkedType as CommRequest["linkedType"],
    variables: Object.fromEntries(
      Object.entries(input.payload ?? {}).map(([k, v]) => [k, String(v ?? "")]),
    ),
  };
}

async function dispatchEmailChannel(
  eventKey: CommunicationEventKey,
  input: DispatchCommunicationEventInput,
): Promise<{ success: boolean; provider: string; error?: string; messageId?: string }> {
  const templateType = eventKeyToEmailTemplate(eventKey, input.payload as Record<string, unknown>);
  if (!templateType || !input.recipient.email) {
    return { success: false, provider: "none", error: "No email template or recipient email" };
  }

  const vars = {
    recipientName: input.recipient.name,
    recipientEmail: input.recipient.email,
    firmName: String(input.payload?.tenant_name ?? input.payload?.firm_name ?? "AVS"),
    productName: String(input.payload?.product_name ?? APP_NAME),
    actionUrl:
      input.documentUrl ?? String(input.payload?.document_url ?? input.payload?.action_url ?? ""),
    documentType: String(input.payload?.document_type ?? ""),
    documentNumber: String(input.payload?.document_number ?? input.payload?.invoice_number ?? ""),
    amountFormatted: String(input.payload?.amount ?? ""),
    roleOrPortal: String(input.payload?.role ?? input.payload?.portal ?? ""),
    otpCode: String(input.payload?.otp_code ?? ""),
    ticketNumber: String(input.payload?.ticket_number ?? ""),
    ticketSubject: String(input.payload?.ticket_subject ?? ""),
    ticketStatus: String(input.payload?.ticket_status ?? ""),
    logoUrl: String(input.payload?.logo_url ?? ""),
  };

  const result = await centralEmailService.sendTemplateEmail(templateType, vars, {
    jobContext: {
      eventKey,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      branchId: input.branchId,
    },
  });

  return {
    success: result.success,
    provider: "email_smtp",
    messageId: result.emailId,
    error: result.error,
  };
}

async function dispatchWhatsAppChannel(
  eventKey: CommunicationEventKey,
  input: DispatchCommunicationEventInput,
): Promise<{ success: boolean; provider: string; error?: string; messageId?: string }> {
  const req = mapEventToCommRequest(eventKey, input, "whatsapp");
  if (!req) {
    return { success: false, provider: "none", error: `WhatsApp not mapped for ${eventKey}` };
  }
  if (!input.recipient.phone) {
    return { success: false, provider: "none", error: "No recipient phone" };
  }

  const result = await commService.send(req, { skipQueueOnFailure: false });
  return {
    success: result.success,
    provider: result.provider,
    messageId: result.messageId,
    error: result.error,
  };
}

/**
 * Dispatch a canonical communication event through the AVS platform.
 * Non-blocking: creates job, processes channels async, never throws to caller.
 */
export async function dispatchCommunicationEvent(
  input: DispatchCommunicationEventInput,
): Promise<DispatchResult> {
  const productId = input.productId ?? DEFAULT_AVS_PRODUCT;
  const errors: string[] = [];
  const channelsSucceeded: CommunicationChannel[] = [];

  try {
    const { data: firmIdData } = await (supabase as any).rpc("my_firm_id");
    const firmId = firmIdData ? String(firmIdData) : null;
    if (firmId) {
      await assertCommunicationScope({
        firmId,
        partyId: input.payload?.party_id?.toString() ?? input.payload?.customer_id?.toString(),
        referenceType: input.referenceType,
        referenceId: input.referenceId,
      });
    }
  } catch (scopeErr) {
    return {
      jobId: null,
      success: false,
      channelsAttempted: [],
      channelsSucceeded: [],
      errors: [
        scopeErr instanceof Error ? scopeErr.message : "Communication scope validation failed",
      ],
    };
  }

  const routing = await resolveChannelsForEvent({
    productId,
    eventKey: input.eventKey,
    branchId: input.branchId,
    explicitChannels: input.channels,
    emailFallbackOnWhatsAppFailure: input.emailFallbackOnWhatsAppFailure,
  });

  const channels = routing.channels.filter((ch) => channelSupportsEvent(ch, input.eventKey));

  const job = await createCommunicationJob({
    productId,
    eventKey: input.eventKey,
    branchId: input.branchId,
    channels,
    recipient: input.recipient,
    payload: input.payload as Record<string, unknown>,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    documentUrl: input.documentUrl,
    scheduledFor: input.scheduledFor,
  });

  const jobId = job?.id ?? null;
  if (jobId) {
    await updateJobStatus(jobId, "processing");
  }

  let whatsappFailed = false;

  for (const channel of channels) {
    try {
      if (channel === "email") {
        const res = await dispatchEmailChannel(input.eventKey, input);
        if (jobId) {
          await recordChannelResult({
            jobId,
            channel: "email",
            provider: res.provider,
            status: res.success ? "sent" : "failed",
            externalMessageId: res.messageId,
            errorMessage: res.error,
          });
        }
        if (res.success) channelsSucceeded.push("email");
        else errors.push(`email: ${res.error}`);
      } else if (channel === "whatsapp") {
        const res = await dispatchWhatsAppChannel(input.eventKey, input);
        if (jobId) {
          await recordChannelResult({
            jobId,
            channel: "whatsapp",
            provider: res.provider,
            status: res.success ? "sent" : "failed",
            externalMessageId: res.messageId,
            errorMessage: res.error,
          });
        }
        if (res.success) channelsSucceeded.push("whatsapp");
        else {
          whatsappFailed = true;
          errors.push(`whatsapp: ${res.error}`);
        }
      } else if (channel === "sms") {
        const res = await sendSmsViaAdapter({
          to: input.recipient.phone ?? "",
          body: String(input.payload?.otp_code ?? input.payload?.message ?? input.eventKey),
          eventKey: input.eventKey,
        });
        if (jobId) {
          await recordChannelResult({
            jobId,
            channel: "sms",
            provider: res.provider,
            status: "failed",
            errorMessage: res.error,
          });
        }
        errors.push(`sms: ${res.error}`);
      } else if (channel === "in_app") {
        try {
          await supabase.from("platform_notifications" as never).insert({
            title: String(input.payload?.title ?? input.eventKey.replace(/\./g, " ")),
            body: String(input.payload?.body ?? input.payload?.message ?? ""),
            href: input.documentUrl ?? null,
            kind: "communication",
          } as never);
          if (jobId) {
            await recordChannelResult({
              jobId,
              channel: "in_app",
              provider: "in_app",
              status: "delivered",
            });
          }
          channelsSucceeded.push("in_app");
        } catch (err) {
          errors.push(`in_app: ${err instanceof Error ? err.message : "failed"}`);
        }
      }
    } catch (err) {
      errors.push(`${channel}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  // Email fallback when WhatsApp fails
  if (
    whatsappFailed &&
    routing.emailFallbackEnabled &&
    input.recipient.email &&
    !channelsSucceeded.includes("email") &&
    !channels.includes("email")
  ) {
    const res = await dispatchEmailChannel(input.eventKey, input);
    if (jobId) {
      await recordChannelResult({
        jobId,
        channel: "email",
        provider: res.provider,
        status: res.success ? "sent" : "failed",
        externalMessageId: res.messageId,
        errorMessage: res.error,
        fallbackFromChannel: "whatsapp",
      });
    }
    if (res.success) channelsSucceeded.push("email");
    else errors.push(`email (fallback): ${res.error}`);
  }

  const success = channelsSucceeded.length > 0;
  if (jobId) {
    const finalStatus =
      channelsSucceeded.length === channels.length
        ? "completed"
        : channelsSucceeded.length > 0
          ? "partial"
          : "failed";
    await updateJobStatus(jobId, finalStatus, errors.join("; ") || undefined);
  }

  return {
    jobId,
    success,
    channelsAttempted: channels,
    channelsSucceeded,
    errors,
  };
}

/** Convenience: invoice ready — email default, WhatsApp if configured */
export async function notifyInvoiceReady(opts: {
  branchId: string;
  recipient: DispatchCommunicationEventInput["recipient"];
  invoiceId: string;
  invoiceNumber: string;
  amount: string;
  documentUrl?: string;
  channels?: CommunicationChannel[];
  emailFallbackOnWhatsAppFailure?: boolean;
}): Promise<DispatchResult> {
  return dispatchCommunicationEvent({
    eventKey: "invoice.ready",
    branchId: opts.branchId,
    recipient: opts.recipient,
    referenceType: "invoice",
    referenceId: opts.invoiceId,
    documentUrl: opts.documentUrl,
    channels: opts.channels,
    emailFallbackOnWhatsAppFailure: opts.emailFallbackOnWhatsAppFailure,
    payload: {
      invoice_number: opts.invoiceNumber,
      amount: opts.amount,
      document_type: "Invoice",
    },
  });
}

export async function notifyPortalInvitation(opts: {
  portal: "customer" | "karigar" | "supplier" | "internal";
  recipient: DispatchCommunicationEventInput["recipient"];
  actionUrl: string;
  firmName: string;
  productName?: string;
}): Promise<DispatchResult> {
  return dispatchCommunicationEvent({
    eventKey: "portal.invited",
    channels: ["email"],
    recipient: opts.recipient,
    documentUrl: opts.actionUrl,
    payload: {
      portal: opts.portal,
      tenant_name: opts.firmName,
      firm_name: opts.firmName,
      action_url: opts.actionUrl,
      document_url: opts.actionUrl,
      role: opts.portal,
      product_name: opts.productName ?? APP_NAME,
    },
  });
}

/** Branded password reset notification (Supabase Auth still sends its own link) */
export async function notifyPasswordReset(opts: {
  recipient: DispatchCommunicationEventInput["recipient"];
  actionUrl: string;
  firmName?: string;
}): Promise<DispatchResult> {
  return dispatchCommunicationEvent({
    eventKey: "auth.password_reset",
    channels: ["email"],
    recipient: opts.recipient,
    documentUrl: opts.actionUrl,
    payload: {
      action_url: opts.actionUrl,
      tenant_name: opts.firmName ?? "AVS",
      firm_name: opts.firmName ?? "AVS",
    },
  });
}

/** OTP login code — channels resolved by platform OTP policy */
export async function notifyOtpLogin(opts: {
  recipient: DispatchCommunicationEventInput["recipient"];
  otpCode: string;
  firmName?: string;
  channels?: CommunicationChannel[];
}): Promise<DispatchResult> {
  const { resolveOtpChannels } = await import("./otp-channel-router");
  const routing = await resolveOtpChannels();
  return dispatchCommunicationEvent({
    eventKey: "auth.otp_login",
    channels: opts.channels ?? routing.channels,
    recipient: opts.recipient,
    payload: {
      otp_code: opts.otpCode,
      tenant_name: opts.firmName ?? "AVS",
      firm_name: opts.firmName ?? "AVS",
    },
  });
}
