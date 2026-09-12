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

const LOCAL_STORAGE_KEY = "avs_scheduled_jobs_cache";

interface LocalJobRecord {
  job_key: string;
  cadence: JobCadence;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
}

function getLocalJobRecords(): Record<string, LocalJobRecord> {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(LOCAL_STORAGE_KEY) : null;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalJobRecord(record: LocalJobRecord): void {
  try {
    if (typeof localStorage === "undefined") return;
    const records = getLocalJobRecords();
    records[record.job_key] = record;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(records));
  } catch {
    /* storage unavailable */
  }
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
  // 1. Fast local synchronous cache check
  const local = getLocalJobRecords()[key];
  if (local?.last_run_at) {
    return local as unknown as Record<string, unknown>;
  }

  // 2. Query remote scheduled_jobs if firm context exists
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.user) return null;

    const { data, error } = await (supabase as any)
      .from("scheduled_jobs")
      .select("job_key,cadence,last_run_at,last_status,last_error")
      .eq("job_key", key)
      .maybeSingle();

    if (error || !data) return null;

    saveLocalJobRecord(data as LocalJobRecord);
    return (data as Record<string, unknown> | null) ?? null;
  } catch {
    return null;
  }
}

async function saveJobRow(
  job: ScheduledJob,
  status: "ok" | "failed",
  now: Date,
  errorMessage: string | null,
): Promise<void> {
  const nowIso = now.toISOString();

  // Always update local cache immediately so subsequent ticks know it ran
  saveLocalJobRecord({
    job_key: job.key,
    cadence: job.cadence,
    last_run_at: nowIso,
    last_status: status,
    last_error: errorMessage,
  });

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.user) return;

    // Check if user has an active firm ID
    const { data: firmId, error: firmErr } = await (supabase as any).rpc("my_firm_id");
    if (firmErr || !firmId) {
      // User is SaaS admin or unassigned to a firm; retain in local storage only
      return;
    }

    const payload = {
      firm_id: firmId,
      job_key: job.key,
      cadence: job.cadence,
      last_run_at: nowIso,
      last_status: status,
      last_error: errorMessage,
      updated_at: nowIso,
    };

    await (supabase as any)
      .from("scheduled_jobs")
      .upsert(payload, { onConflict: "firm_id,job_key" });
  } catch {
    // Non-critical background telemetry persistence — local cache already holds state
  }
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
    } catch {
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
      console.warn(`[Scheduler] Job "${job.key}" failed:`, err);
      await saveJobRow(job, "failed", now, message);
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
