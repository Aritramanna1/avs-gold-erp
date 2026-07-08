/**
 * Event-Driven Communication Automation (Plan 1 Step 9).
 *
 * The single entry point every business-event trigger calls into —
 * `emitBusinessEvent()`. It never sends anything itself; it only decides
 * WHETHER to send (per useAutomationSettings' per-event toggle) and on
 * WHICH channels, then delegates the actual send to commService.send() so
 * every automated message goes through the exact same provider-fallback +
 * retry-queue + logging path as a manually-triggered one.
 *
 * Business modules should call ONLY this function (or, for a manual
 * override, commService.send() directly) — never construct a CommRequest
 * and reach into a specific provider themselves.
 */
import { commService } from "./service";
import { useAutomationSettings, type AutomationEventKey } from "./automation-settings-store";
import type { CommChannel, CommRequest, MessageTemplate } from "./types";

const EVENT_TEMPLATE: Record<AutomationEventKey, MessageTemplate> = {
  invoice_created: "invoice",
  invoice_paid: "receipt",
  payment_received: "receipt",
  payment_reminder: "payment_reminder",
  order_confirmation: "order_confirmation",
  order_ready: "order_ready",
  order_delivered: "order_delivered",
  manufacturing_update: "manufacturing_bill",
  repair_update: "repair_ready",
  gold_settlement_reminder: "gold_settlement_reminder",
  outstanding_reminder: "payment_reminder",
  daily_summary: "business_report",
  weekly_business_report: "business_report",
  monthly_business_report: "business_report",
  monthly_ledger_statement: "business_report",
};

export interface BusinessEventInput {
  branchId: string;
  recipient: { name: string; phone?: string; email?: string };
  linkedId: string;
  linkedType: CommRequest["linkedType"];
  variables?: Record<string, string | number>;
}

/**
 * Evaluates automation rules for `eventKey` and fires commService.send() for
 * every enabled channel. Never throws — a communication failure must never
 * block or roll back the business action that triggered it (invoice
 * creation succeeds whether or not the WhatsApp send does); errors are
 * caught, logged, and — via commService's own queue — retried in the
 * background.
 */
export async function emitBusinessEvent(
  eventKey: AutomationEventKey,
  input: BusinessEventInput,
): Promise<void> {
  const settings = useAutomationSettings.getState();
  if (!settings.isEnabled(eventKey)) return;

  const channels = settings.channelsFor(eventKey);
  const template = EVENT_TEMPLATE[eventKey];

  await Promise.all(
    channels.map(async (channel: CommChannel) => {
      try {
        await commService.send({
          channel,
          template,
          branchId: input.branchId,
          recipient: input.recipient,
          linkedId: input.linkedId,
          linkedType: input.linkedType,
          variables: input.variables,
        });
      } catch (err) {
        console.error(`[CommAutomation] emitBusinessEvent(${eventKey}, ${channel}) failed:`, err);
      }
    }),
  );
}
