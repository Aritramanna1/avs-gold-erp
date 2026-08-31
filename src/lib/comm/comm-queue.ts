/**
 * Supabase-backed communication retry queue (`communication_jobs`).
 */
import type { CommRequest } from "./types";
import { commService } from "./service";
import {
  createCommunicationJob,
  fetchCommunicationCentre,
  updateJobStatus,
} from "./platform/communication-jobs-store";
import {
  DEFAULT_AVS_PRODUCT,
  LEGACY_TEMPLATE_TO_EVENT,
  type CommunicationEventKey,
} from "./platform/communication-events";

export interface CommQueueEntry {
  id: string;
  request: CommRequest;
  log_event_id: string | null;
  status: "pending" | "sent" | "permanently_failed";
  attempts: number;
  last_error: string | null;
  last_attempt_at: string | null;
  next_attempt_at: string | null;
  created_at: string;
  sent_at: string | null;
}

function mapLinkedType(referenceType: string | null | undefined): CommRequest["linkedType"] {
  const allowed: CommRequest["linkedType"][] = ["invoice", "order", "job", "repair", "estimate"];
  if (referenceType && allowed.includes(referenceType as CommRequest["linkedType"])) {
    return referenceType as CommRequest["linkedType"];
  }
  return "job";
}

function mapJobToEntry(
  job: Awaited<ReturnType<typeof fetchCommunicationCentre>>[number],
): CommQueueEntry {
  const status: CommQueueEntry["status"] =
    job.status === "completed" || job.status === "partial"
      ? "sent"
      : job.status === "failed" || job.status === "cancelled"
        ? "permanently_failed"
        : "pending";

  const request: CommRequest = {
    channel:
      job.channelsRequested[0] === "whatsapp"
        ? "whatsapp"
        : job.channelsRequested[0] === "sms"
          ? "sms"
          : "email",
    template: "custom",
    branchId: "MAIN",
    recipient: { name: job.recipientName },
    linkedId: job.referenceId ?? job.id,
    linkedType: mapLinkedType(job.referenceType),
  };

  return {
    id: job.id,
    request,
    log_event_id: null,
    status,
    attempts: 0,
    last_error: job.channelResults.find((r) => r.errorMessage)?.errorMessage ?? null,
    last_attempt_at: job.createdAt,
    next_attempt_at: null,
    created_at: job.createdAt,
    sent_at: status === "sent" ? job.createdAt : null,
  };
}

export async function enqueueForRetry(req: CommRequest, logEventId?: string): Promise<string> {
  const eventKey = (LEGACY_TEMPLATE_TO_EVENT[req.template] ??
    "document.ready") as CommunicationEventKey;

  const job = await createCommunicationJob({
    productId: DEFAULT_AVS_PRODUCT,
    eventKey,
    branchId: req.branchId || "MAIN",
    channels: [req.channel],
    recipient: req.recipient,
    payload: {
      template: req.template,
      retryOfLogId: logEventId ?? null,
      linkedType: req.linkedType,
    },
    referenceType: req.linkedType,
    referenceId: req.linkedId,
    scheduledFor: new Date(Date.now() + 60_000).toISOString(),
  });

  if (!job) {
    throw new Error("Failed to persist communication retry job");
  }
  return job.id;
}

export async function getQueueEntries(
  status?: CommQueueEntry["status"],
): Promise<CommQueueEntry[]> {
  const remoteStatus =
    status === "sent" ? "completed" : status === "permanently_failed" ? "failed" : "pending";
  const rows = await fetchCommunicationCentre({ limit: 100, status: remoteStatus });
  return rows.map(mapJobToEntry);
}

export async function drainCommQueue(): Promise<{
  attempted: number;
  sent: number;
  stillPending: number;
}> {
  const pending = await fetchCommunicationCentre({ limit: 25, status: "pending" });
  let sent = 0;

  for (const job of pending) {
    const eventKey = job.eventKey as CommunicationEventKey;
    const template =
      Object.entries(LEGACY_TEMPLATE_TO_EVENT).find(([, v]) => v === eventKey)?.[0] ?? "custom";
    const channel = job.channelsRequested[0];

    if (channel !== "email" && channel !== "whatsapp" && channel !== "sms") {
      await updateJobStatus(job.id, "failed", "Unsupported channel for retry drain");
      continue;
    }

    const result = await commService.send(
      {
        channel,
        template: template as CommRequest["template"],
        branchId: "MAIN",
        recipient: { name: job.recipientName },
        linkedId: job.referenceId ?? job.id,
        linkedType: mapLinkedType(job.referenceType),
      },
      { skipQueueOnFailure: true },
    );

    if (result.success) {
      sent += 1;
      await updateJobStatus(job.id, "completed");
    } else {
      await updateJobStatus(job.id, "failed", result.error ?? "Retry failed");
    }
  }

  const stillPending = (await fetchCommunicationCentre({ limit: 1, status: "pending" })).length;
  return { attempted: pending.length, sent, stillPending };
}

let schedulerTimer: ReturnType<typeof setInterval> | null = null;

export function startCommQueueScheduler(intervalMs = 30_000): () => void {
  stopCommQueueScheduler();
  schedulerTimer = setInterval(() => {
    void drainCommQueue().catch((err) => console.error("[CommQueue] drain failed:", err));
  }, intervalMs);
  return () => stopCommQueueScheduler();
}

export function stopCommQueueScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}
