/**
 * Background Scheduler (Plan 1 Step 9).
 *
 * Runs entirely inside the desktop app process — no external cron, no
 * server. Each registered job declares a `cadence` (daily/weekly/monthly)
 * and a `run()` handler; `checkDueJobs()` (called on an interval) compares
 * "now" against the job's persisted `last_run_at` (SQLite `scheduled_jobs`
 * table, survives restart) and runs it if a new calendar period has started
 * since — so a job due while the app was closed fires on the next check
 * instead of being silently skipped, and a job that already ran today never
 * re-runs today even across many interval ticks.
 */
import { runLocal, getDb, queryTable, initLocalDb } from "@/lib/local-db";

export type JobCadence = "daily" | "weekly" | "monthly";

export interface ScheduledJob {
  key: string;
  cadence: JobCadence;
  run: () => Promise<void>;
}

const registry = new Map<string, ScheduledJob>();

export function registerJob(job: ScheduledJob): void {
  registry.set(job.key, job);
}

function periodKey(date: Date, cadence: JobCadence): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  if (cadence === "daily") return `${y}-${m}-${d}`;
  if (cadence === "monthly") return `${y}-${m}`;
  // weekly: ISO week number (good enough — only used for equality comparison, not calendar display)
  const firstJan = new Date(Date.UTC(y, 0, 1));
  const dayOfYear = Math.floor((date.getTime() - firstJan.getTime()) / 86_400_000);
  const week = Math.floor((dayOfYear + firstJan.getUTCDay()) / 7);
  return `${y}-W${week}`;
}

function isDue(lastRunAt: string | null, cadence: JobCadence, now: Date): boolean {
  if (!lastRunAt) return true;
  return periodKey(new Date(lastRunAt), cadence) !== periodKey(now, cadence);
}

function getJobRow(key: string): Record<string, unknown> | null {
  const rows = queryTable("scheduled_jobs", "job_key = ?", [key]) as Record<string, unknown>[];
  return rows[0] ?? null;
}

/** Checks every registered job and runs those that are due. Safe to call repeatedly/concurrently. */
export async function checkDueJobs(
  now: Date = new Date(),
): Promise<{ ran: string[]; failed: string[] }> {
  await initLocalDb();
  const ran: string[] = [];
  const failed: string[] = [];

  for (const job of registry.values()) {
    const row = getJobRow(job.key);
    const lastRunAt = (row?.last_run_at as string) ?? null;
    if (!isDue(lastRunAt, job.cadence, now)) continue;

    try {
      await job.run();
      ran.push(job.key);
      await runLocal(() => {
        getDb().run(
          `INSERT INTO scheduled_jobs (job_key, last_run_at, last_status, last_error)
           VALUES (?, ?, 'ok', NULL)
           ON CONFLICT(job_key) DO UPDATE SET last_run_at = excluded.last_run_at, last_status = 'ok', last_error = NULL;`,
          [job.key, now.toISOString()],
        );
      });
    } catch (err) {
      failed.push(job.key);
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Scheduler] Job "${job.key}" failed:`, err);
      // A failed job still gets a last_run_at bump for the current period —
      // a genuinely broken daily job (e.g. bad report query) should surface
      // via last_error for someone to investigate, not retry every 60s
      // forever and spam failure logs all day.
      await runLocal(() => {
        getDb().run(
          `INSERT INTO scheduled_jobs (job_key, last_run_at, last_status, last_error)
           VALUES (?, ?, 'failed', ?)
           ON CONFLICT(job_key) DO UPDATE SET last_run_at = excluded.last_run_at, last_status = 'failed', last_error = excluded.last_error;`,
          [job.key, now.toISOString(), message],
        );
      });
    }
  }

  return { ran, failed };
}

export async function getJobStatuses(): Promise<
  Array<{
    key: string;
    cadence: JobCadence;
    lastRunAt: string | null;
    lastStatus: string | null;
    lastError: string | null;
  }>
> {
  await initLocalDb();
  return Array.from(registry.values()).map((job) => {
    const row = getJobRow(job.key);
    return {
      key: job.key,
      cadence: job.cadence,
      lastRunAt: (row?.last_run_at as string) ?? null,
      lastStatus: (row?.last_status as string) ?? null,
      lastError: (row?.last_error as string) ?? null,
    };
  });
}

let schedulerHandle: ReturnType<typeof setInterval> | null = null;

export function startScheduler(intervalMs = 60_000): () => void {
  if (schedulerHandle) return () => stopScheduler();
  schedulerHandle = setInterval(() => {
    checkDueJobs().catch((err) => console.error("[Scheduler] checkDueJobs failed:", err));
  }, intervalMs);
  return () => stopScheduler();
}

export function stopScheduler(): void {
  if (schedulerHandle) {
    clearInterval(schedulerHandle);
    schedulerHandle = null;
  }
}
