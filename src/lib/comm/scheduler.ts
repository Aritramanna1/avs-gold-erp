/**
 * Background scheduler state backed by Supabase.
 *
 * Jobs still run in the browser/app process, but last-run status is durable in
 * `scheduled_jobs` instead of the retired local SQLite layer.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";

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
  const firstJan = new Date(Date.UTC(y, 0, 1));
  const dayOfYear = Math.floor((date.getTime() - firstJan.getTime()) / 86_400_000);
  const week = Math.floor((dayOfYear + firstJan.getUTCDay()) / 7);
  return `${y}-W${week}`;
}

function isDue(lastRunAt: string | null, cadence: JobCadence, now: Date): boolean {
  if (!lastRunAt) return true;
  return periodKey(new Date(lastRunAt), cadence) !== periodKey(now, cadence);
}

async function getJobRow(key: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await (supabase as any)
    .from("scheduled_jobs")
    .select("job_key,cadence,last_run_at,last_status,last_error")
    .eq("job_key", key)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Record<string, unknown> | null) ?? null;
}

async function saveJobRow(
  job: ScheduledJob,
  status: "ok" | "failed",
  now: Date,
  errorMessage: string | null,
): Promise<void> {
  const { error } = await (supabase as any).from("scheduled_jobs").upsert(
    {
      job_key: job.key,
      cadence: job.cadence,
      last_run_at: now.toISOString(),
      last_status: status,
      last_error: errorMessage,
      updated_at: now.toISOString(),
    },
    { onConflict: "firm_id,job_key" },
  );
  if (error) throw new Error(error.message);
}

export async function checkDueJobs(
  now: Date = new Date(),
): Promise<{ ran: string[]; failed: string[] }> {
  const ran: string[] = [];
  const failed: string[] = [];

  for (const job of registry.values()) {
    let row: Record<string, unknown> | null = null;
    try {
      row = await getJobRow(job.key);
    } catch (error) {
      console.error(`[Scheduler] Could not load state for "${job.key}":`, error);
      failed.push(job.key);
      continue;
    }

    const lastRunAt = (row?.last_run_at as string) ?? null;
    if (!isDue(lastRunAt, job.cadence, now)) continue;

    try {
      await job.run();
      ran.push(job.key);
      await saveJobRow(job, "ok", now, null);
    } catch (err) {
      failed.push(job.key);
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Scheduler] Job "${job.key}" failed:`, err);
      await saveJobRow(job, "failed", now, message).catch((saveError) =>
        console.error(`[Scheduler] Could not save failure for "${job.key}":`, saveError),
      );
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
  const statuses = [];
  for (const job of registry.values()) {
    const row = await getJobRow(job.key).catch(() => null);
    statuses.push({
      key: job.key,
      cadence: job.cadence,
      lastRunAt: (row?.last_run_at as string) ?? null,
      lastStatus: (row?.last_status as string) ?? null,
      lastError: (row?.last_error as string) ?? null,
    });
  }
  return statuses;
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
