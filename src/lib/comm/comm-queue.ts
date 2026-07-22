import type { CommRequest, CommResult } from "./types";

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

const queue: CommQueueEntry[] = [];
const makeId = () => `cq_${crypto.randomUUID()}`;

export async function enqueueForRetry(req: CommRequest, logEventId?: string): Promise<string> {
  const id = makeId();
  const now = new Date().toISOString();
  queue.push({
    id,
    request: req,
    log_event_id: logEventId ?? null,
    status: "pending",
    attempts: 0,
    last_error: null,
    last_attempt_at: null,
    next_attempt_at: now,
    created_at: now,
    sent_at: null,
  });
  return id;
}

export async function getQueueEntries(status?: CommQueueEntry["status"]): Promise<CommQueueEntry[]> {
  return queue.filter((entry) => !status || entry.status === status);
}

export async function drainCommQueue(): Promise<{ attempted: number; sent: number; failed: number }> {
  const { commService } = await import("./service");
  let attempted = 0;
  let sent = 0;
  let failed = 0;
  for (const entry of queue.filter((item) => item.status === "pending")) {
    attempted += 1;
    entry.attempts += 1;
    entry.last_attempt_at = new Date().toISOString();
    const result: CommResult = await commService.send(entry.request);
    if (result.success) {
      entry.status = "sent";
      entry.sent_at = new Date().toISOString();
      sent += 1;
    } else if (entry.attempts >= 6) {
      entry.status = "permanently_failed";
      entry.last_error = result.error ?? "Communication failed";
      failed += 1;
    }
  }
  return { attempted, sent, failed };
}

let schedulerHandle: ReturnType<typeof setInterval> | null = null;
export function startCommQueueScheduler(intervalMs = 30_000): () => void {
  if (!schedulerHandle) schedulerHandle = setInterval(() => void drainCommQueue(), intervalMs);
  return stopCommQueueScheduler;
}
export function stopCommQueueScheduler(): void {
  if (schedulerHandle) clearInterval(schedulerHandle);
  schedulerHandle = null;
}
