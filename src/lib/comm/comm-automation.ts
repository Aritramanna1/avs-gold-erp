/**
 * Event-Driven Communication Automation — routes through AVS Communication Platform.
 */
import { dispatchCommunicationEvent } from "./platform/avs-communication-platform";
import type { CommunicationEventKey, CommunicationChannel } from "./platform/communication-events";
import { fetchNotificationPreferences } from "./platform/notification-preferences-store";
import { useAutomationSettings, type AutomationEventKey } from "./automation-settings-store";
import type { AutomaticEventKey } from "./email-config-store";
import type { CommRequest } from "./types";

const EVENT_MAP: Partial<Record<AutomationEventKey, CommunicationEventKey>> = {
  invoice_created: "invoice.ready",
  invoice_paid: "payment.received",
  payment_received: "payment.received",
  payment_reminder: "payment.due",
  order_confirmation: "order.created",
  order_ready: "order.ready",
  order_delivered: "order.ready",
  manufacturing_update: "document.ready",
  repair_update: "order.ready",
  gold_settlement_reminder: "payment.due",
  outstanding_reminder: "payment.due",
  daily_summary: "report.daily",
  weekly_business_report: "report.weekly",
  monthly_business_report: "report.monthly",
  monthly_ledger_statement: "report.monthly",
};

export interface BusinessEventInput {
  branchId: string;
  recipient: { name: string; phone?: string; email?: string };
  linkedId: string;
  linkedType: CommRequest["linkedType"];
  variables?: Record<string, string | number>;
}

export async function emitBusinessEvent(
  eventKey: AutomationEventKey,
  input: BusinessEventInput,
): Promise<void> {
  const settings = useAutomationSettings.getState();
  const platformEvent = EVENT_MAP[eventKey];
  if (!platformEvent) {
    console.warn(`[CommAutomation] No platform mapping for ${eventKey}`);
    return;
  }

  const prefs = await fetchNotificationPreferences({ branchId: input.branchId });
  const pref = prefs.find((p) => p.eventKey === platformEvent);
  const legacyEnabled = settings.isEnabled(eventKey);
  const enabled = pref ? pref.enabled : legacyEnabled;
  if (!enabled) return;

  const channels: CommunicationChannel[] = pref
    ? pref.channels
    : (settings.channelsFor(eventKey) as CommunicationChannel[]);
  if (channels.length === 0) return;

  const rule = settings.rules.find((r) => r.eventKey === eventKey);
  const emailFallback =
    rule?.emailFallbackOnWhatsAppFailure ??
    settings.rules.find((r) => r.eventKey === eventKey)?.emailFallbackOnWhatsAppFailure ??
    true;

  try {
    // 1. Dispatch Email as Primary Automatic Channel with full PDF attachment
    const autoEventKey: AutomaticEventKey =
      eventKey === "order_confirmation"
        ? "order_created"
        : eventKey === "invoice_paid"
          ? "payment_received"
          : (eventKey as AutomaticEventKey);

    const linked = String(input.linkedType);
    const docType =
      linked === "invoice"
        ? "gst_invoice"
        : linked === "order"
          ? "order_slip"
          : linked === "payment"
            ? "payment_receipt"
            : linked === "credit_note"
              ? "credit_note"
              : undefined;

    const { dispatchAutomaticBusinessEvent } = await import("./automatic-communication-engine");
    await dispatchAutomaticBusinessEvent({
      eventKey: autoEventKey,
      branchId: input.branchId,
      recipient: input.recipient,
      docType: docType as any,
      recordId: input.linkedId,
      documentNumber: String(
        input.variables?.invoiceNo ??
          input.variables?.documentNumber ??
          input.variables?.orderNo ??
          input.linkedId,
      ),
      variables: input.variables,
    });

    // 2. Also dispatch to AVS Communication Platform router for secondary channels (e.g. WhatsApp, In-App)
    await dispatchCommunicationEvent({
      eventKey: platformEvent,
      branchId: input.branchId,
      recipient: input.recipient,
      channels,
      referenceType: input.linkedType,
      referenceId: input.linkedId,
      emailFallbackOnWhatsAppFailure: emailFallback !== false,
      payload: {
        ...Object.fromEntries(
          Object.entries(input.variables ?? {}).map(([k, v]) => [k, String(v)]),
        ),
        document_number: String(
          input.variables?.invoiceNo ?? input.variables?.documentNumber ?? input.linkedId,
        ),
        amount: String(input.variables?.amount ?? input.variables?.reportBody ?? ""),
        body: String(input.variables?.reportBody ?? ""),
        title: String(input.variables?.reportTitle ?? eventKey),
      },
    });
  } catch (err) {
    console.error(`[CommAutomation] emitBusinessEvent(${eventKey}) failed:`, err);
  }
}
