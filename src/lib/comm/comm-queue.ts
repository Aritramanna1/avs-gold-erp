/**
 * Durable retry queue for the Communication Service (Plan 1 Step 9 slice).
 *
 * commService.send() still attempts delivery immediately through the
 * configured provider chain, exactly as before — this queue only takes over
 * once EVERY configured provider for a request has failed. Instead of that
 * failure being the end of the story (previous behavior: log "failed" and
 * show a toast), the request is durably queued here and retried with
 * exponential backoff, surviving an app restart, until it succeeds or
 * exhausts MAX_ATTEMPTS — matching "queue, retry, recover after restart,
 * never silently lose a message."
 *
 * This module has no knowledge of *why* commService.send() failed — it just
 * replays the exact same CommRequest through commService.send() again later.
 * A permanently misconfigured provider (e.g. no SMTP credentials at all)
 * will keep failing and eventually land in `permanently_failed`, which is
 * correct: that's a configuration problem, not a transient one, and it must
 * stay visible rather than retry forever.
 */
import { runLocal, getDb, queryTable, initLocalDb } from "@/lib/local-db";
import type { CommRequest, CommResult } from "./types";

const MAX_ATTEMPTS = 6;
// 2s, 10s, 1m, 5m, 30m, 2h — deliberately wider than sync-engine's outbox
// backoff, since a stuck email/WhatsApp provider is far more likely to need
// minutes-to-hours (rate limits, provider outages) than seconds to recover.
const BACKOFF_SCHEDULE_MS = [2_000, 10_000, 60_000, 300_000, 1_800_000, 7_200_000];

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `cq_${crypto.randomUUID()}`;
  return `cq_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function backoffDelayMs(attempts: number): number {
  return BACKOFF_SCHEDULE_MS[Math.min(attempts, BACKOFF_SCHEDULE_MS.length - 1)];
}

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

/** Queues a failed send for background retry. `logEventId` links back to the CommEvent already recorded for the original failed attempt. */
export async function enqueueForRetry(req: CommRequest, logEventId?: string): Promise<string> {
  const id = makeId();
  await runLocal(() => {
    getDb().run(
      `INSERT INTO comm_queue (id, request, log_event_id, status, attempts, created_at, next_attempt_at)
       VALUES (?, ?, ?, 'pending', 0, ?, ?);`,
      [
        id,
        JSON.stringify(req),
        logEventId ?? null,
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );
  });
  return id;
}

function parseRow(row: Record<string, unknown>): CommQueueEntry {
  return {
    id: row.id as string,
    request: JSON.parse(row.request as string) as CommRequest,
    log_event_id: (row.log_event_id as string) ?? null,
    status: row.status as CommQueueEntry["status"],
    attempts: Number(row.attempts ?? 0),
    last_error: (row.last_error as string) ?? null,
    last_attempt_at: (row.last_attempt_at as string) ?? null,
    next_attempt_at: (row.next_attempt_at as string) ?? null,
    created_at: row.created_at as string,
    sent_at: (row.sent_at as string) ?? null,
  };
}

/** Assumes the local DB has already been initialized (true after any enqueue/drain call). */
export async function getQueueEntries(
  status?: CommQueueEntry["status"],
): Promise<CommQueueEntry[]> {
  await initLocalDb();
  const rows = status
    ? queryTable("comm_queue", "status = ?", [status])
    : queryTable("comm_queue", "", []);
  return (rows as Record<string, unknown>[]).map(parseRow);
}

let draining = false;

/**
 * Drains every due entry, oldest first. Calls back into commService.send()
 * (dynamically imported to avoid a circular import — service.ts imports this
 * module to enqueue). Safe to call repeatedly/concurrently — a re-entrant
 * call while one is already running is a no-op.
 */
export async function drainCommQueue(): Promise<{
  attempted: number;
  sent: number;
  stillPending: number;
}> {
  if (draining) return { attempted: 0, sent: 0, stillPending: 0 };
  draining = true;
  let attempted = 0;
  let sent = 0;
  try {
    await initLocalDb();
    const { commService } = await import("./service");
    const now = new Date().toISOString();
    const due = (
      queryTable("comm_queue", "status = ? AND (next_attempt_at IS NULL OR next_attempt_at <= ?)", [
        "pending",
        now,
      ]) as Record<string, unknown>[]
    )
      .map(parseRow)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));

    for (const entry of due) {
      attempted++;
      let result: CommResult;
      try {
        result = await commService.send(entry.request, { skipQueueOnFailure: true });
      } catch (err) {
        result = {
          success: false,
          provider: "queue_retry",
          channel: entry.request.channel,
          error: err instanceof Error ? err.message : String(err),
          status: "failed",
        };
      }

      if (result.success) {
        sent++;
        await runLocal(() => {
          getDb().run(`UPDATE comm_queue SET status = 'sent', sent_at = ? WHERE id = ?;`, [
            new Date().toISOString(),
            entry.id,
          ]);
        });
        continue;
      }

      const attempts = entry.attempts + 1;
      const permanentlyFailed = attempts >= MAX_ATTEMPTS;
      // Indexed by the PRE-increment attempt count so the first failure
      // schedules BACKOFF_SCHEDULE_MS[0] (2s), not [1] (10s).
      const nextAttemptAt = permanentlyFailed
        ? null
        : new Date(Date.now() + backoffDelayMs(entry.attempts)).toISOString();
      await runLocal(() => {
        getDb().run(
          `UPDATE comm_queue SET status = ?, attempts = ?, last_error = ?, last_attempt_at = ?, next_attempt_at = ? WHERE id = ?;`,
          [
            permanentlyFailed ? "permanently_failed" : "pending",
            attempts,
            result.error ?? "Unknown error",
            new Date().toISOString(),
            nextAttemptAt,
            entry.id,
          ],
        );
      });
    }

    const stillPending = (await getQueueEntries("pending")).length;
    return { attempted, sent, stillPending };
  } finally {
    draining = false;
  }
}

let schedulerHandle: ReturnType<typeof setInterval> | null = null;

/** Starts a periodic background drain. Idempotent — calling twice doesn't start a second interval. */
export function startCommQueueScheduler(intervalMs = 30_000): () => void {
  if (schedulerHandle) return () => stopCommQueueScheduler();
  schedulerHandle = setInterval(() => {
    drainCommQueue().catch((err) => console.error("[CommQueue] drain failed:", err));
  }, intervalMs);
  return () => stopCommQueueScheduler();
}

export function stopCommQueueScheduler(): void {
  if (schedulerHandle) {
    clearInterval(schedulerHandle);
    schedulerHandle = null;
  }
}
