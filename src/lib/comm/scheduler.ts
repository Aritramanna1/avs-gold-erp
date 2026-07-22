/**
 * Background Scheduler (Plan 1 Step 9).
 *
 * Runs entirely inside the desktop app process — no external cron, no
 * server. Each registered job declares a `cadence` (daily/weekly/monthly)
 * and a `run()` handler; `checkDueJobs()` (called on an interval) compares
 * "now" against the job's in-memory `last_run_at`
 * table, survives restart) and runs it if a new calendar period has started
 * since — so a job due while the app was closed fires on the next check
 * instead of being silently skipped, and a job that already ran today never
 * re-runs today even across many interval ticks.
 */

export type JobCadence = "daily" | "weekly" | "monthly";

export interface ScheduledJob {
  key: string;
  cadence: JobCadence;
  run: () => Promise<void>;
}

const registry = new Map<string, ScheduledJob>();
const lastRuns = new Map<string, { at: string; status: string; error: string | null }>();

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

/** Checks every registered job and runs those that are due. Safe to call repeatedly/concurrently. */
export async function checkDueJobs(
  now: Date = new Date(),
): Promise<{ ran: string[]; failed: string[] }> {
  const ran: string[] = [];
  const failed: string[] = [];

  for (const job of registry.values()) {
    const row = lastRuns.get(job.key);
    const lastRunAt = row?.at ?? null;
    if (!isDue(lastRunAt, job.cadence, now)) continue;

    try {
      await job.run();
      ran.push(job.key);
      lastRuns.set(job.key, { at: now.toISOString(), status: "ok", error: null });
    } catch (err) {
      failed.push(job.key);
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Scheduler] Job "${job.key}" failed:`, err);
      // A failed job still gets a last_run_at bump for the current period —
      // a genuinely broken daily job (e.g. bad report query) should surface
      // via last_error for someone to investigate, not retry every 60s
      // forever and spam failure logs all day.
      lastRuns.set(job.key, { at: now.toISOString(), status: "failed", error: message });
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
  return Array.from(registry.values()).map((job) => {
    const row = lastRuns.get(job.key);
    return {
      key: job.key,
      cadence: job.cadence,
      lastRunAt: row?.at ?? null,
      lastStatus: row?.status ?? null,
      lastError: row?.error ?? null,
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
