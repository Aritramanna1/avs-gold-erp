/**
 * Communication History & Analytics (Step 9).
 *
 * Searches/aggregates over the two places communication outcomes actually
 * live: `useCommLog` (every attempted send, in-memory + synced to
 * Supabase's communication_logs table) and the local `comm_queue` SQLite
 * table (retryable failures — see comm-queue.ts). This is a read/query
 * layer only; it doesn't change how either is written.
 *
 * Known gap, stated plainly: CommEvent (comm-log-store.ts) doesn't carry a
 * structured `channel` or `provider` field — that information only exists
 * today as free text inside `body` (e.g. "invoice via WhatsApp Cloud API —
 * sent"), written by service.ts's log(). Rather than regex-parse that
 * unstructured text and risk silently wrong stats, channel/provider
 * breakdowns are NOT included here — only fields that are genuinely
 * structured (kind, templateKind, templateName, target, linkedType, time,
 * recipient) are aggregated. Adding a real `channel` column to CommEvent is
 * the correct fix and a documented follow-up, not something to fake here.
 */
import { useCommLog, type CommEvent, type CommLinkedType } from "@/lib/comm-log-store";
import { getQueueEntries } from "./comm-queue";

export interface CommHistoryFilter {
  recipientQuery?: string;
  templateName?: string;
  linkedType?: CommLinkedType;
  sinceTs?: number;
  untilTs?: number;
}

export function searchCommunicationHistory(filter: CommHistoryFilter = {}): CommEvent[] {
  const events = useCommLog.getState().events;
  return events.filter((e) => {
    if (filter.recipientQuery) {
      const q = filter.recipientQuery.toLowerCase();
      const matches =
        (e.recipientLabel || "").toLowerCase().includes(q) || (e.recipientPhone || "").toLowerCase().includes(q);
      if (!matches) return false;
    }
    if (filter.templateName && e.templateName !== filter.templateName) return false;
    if (filter.linkedType && e.linkedType !== filter.linkedType) return false;
    if (filter.sinceTs !== undefined && e.ts < filter.sinceTs) return false;
    if (filter.untilTs !== undefined && e.ts > filter.untilTs) return false;
    return true;
  });
}

export interface CommAnalytics {
  totalLogged: number;
  byKind: Record<string, number>;
  byTemplate: Record<string, number>;
  byLinkedType: Record<string, number>;
  /** Provider-reported delivery status (queued/sent/delivered/failed/
   *  deep_link_opened) for events sent through a real API provider —
   *  events from the legacy manual-WhatsApp-paste flow have no
   *  deliveryStatus and are excluded, not miscounted as "unknown". */
  byDeliveryStatus: Record<string, number>;
  queue: {
    pending: number;
    sent: number;
    permanentlyFailed: number;
  };
}

/** Aggregate stats over a rolling window (default: last 30 days) plus the current retry-queue snapshot. */
export async function getCommunicationAnalytics(windowDays = 30): Promise<CommAnalytics> {
  const sinceTs = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const events = useCommLog.getState().events.filter((e) => e.ts >= sinceTs);

  const byKind: Record<string, number> = {};
  const byTemplate: Record<string, number> = {};
  const byLinkedType: Record<string, number> = {};
  const byDeliveryStatus: Record<string, number> = {};

  for (const e of events) {
    byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
    byTemplate[e.templateName] = (byTemplate[e.templateName] ?? 0) + 1;
    byLinkedType[e.linkedType] = (byLinkedType[e.linkedType] ?? 0) + 1;
    if (e.deliveryStatus)
      byDeliveryStatus[e.deliveryStatus] = (byDeliveryStatus[e.deliveryStatus] ?? 0) + 1;
  }

  const [pending, sent, permanentlyFailed] = await Promise.all([
    getQueueEntries("pending"),
    getQueueEntries("sent"),
    getQueueEntries("permanently_failed"),
  ]);

  return {
    totalLogged: events.length,
    byKind,
    byTemplate,
    byLinkedType,
    byDeliveryStatus,
    queue: {
      pending: pending.length,
      sent: sent.length,
      permanentlyFailed: permanentlyFailed.length,
    },
  };
}
