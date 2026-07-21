/**
 * Automatic backup scheduler (Database Hardening Priority 4).
 *
 * Wraps `createAndRetainBackup` (local-db.ts) — every run produces a verified,
 * checksummed, encrypted snapshot retained in the `auto_backups` table, then
 * rotates old ones. The most recent VALID backup is never removed by
 * rotation, so an install is never left with zero good backups.
 *
 * Interval is configurable (default 24h) via local meta, checked at RUN time
 * so a changed interval takes effect on the next tick without a restart —
 * same pattern as the disaster-recovery drill's business-rule gate.
 */
import {
  createAndRetainBackup,
  listAutoBackups,
  getMetaValue,
  setMetaValue,
  type AutoBackupEntry,
} from "@/lib/local-db";
import { append as appendAuditEntry } from "./audit-log";

const K_INTERVAL_HOURS = "backup_interval_hours";
const K_RETAIN_COUNT = "backup_retain_count";
const K_LAST_RUN = "backup_last_run_at";
const DEFAULT_INTERVAL_HOURS = 24;
const DEFAULT_RETAIN_COUNT = 7;
const HOUR_MS = 3_600_000;

function metaGet(key: string): string | null {
  try {
    return getMetaValue(key);
  } catch {
    return null;
  }
}

export function getBackupIntervalHours(): number {
  const v = Number(metaGet(K_INTERVAL_HOURS));
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_INTERVAL_HOURS;
}

export function getBackupRetainCount(): number {
  const v = Number(metaGet(K_RETAIN_COUNT));
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_RETAIN_COUNT;
}

export function setBackupConfig(opts: { intervalHours?: number; retainCount?: number }): void {
  if (opts.intervalHours !== undefined) {
    setMetaValue(K_INTERVAL_HOURS, String(Math.max(1, opts.intervalHours)));
  }
  if (opts.retainCount !== undefined) {
    setMetaValue(K_RETAIN_COUNT, String(Math.max(1, opts.retainCount)));
  }
}

/** Runs one backup now, regardless of the interval — used by "Backup Now" and the scheduler. */
export async function runBackupNow(): Promise<AutoBackupEntry> {
  const entry = await createAndRetainBackup(getBackupRetainCount());
  setMetaValue(K_LAST_RUN, new Date().toISOString());
  await appendAuditEntry({
    actorId: null,
    actorEmail: null,
    action: entry.valid ? "backup.auto_created" : "backup.auto_created_invalid",
    entityType: "auto_backups",
    entityId: entry.id,
    before: null,
    after: entry,
    deviceId: null,
  }).catch(() => {});
  return entry;
}

function dueNow(): boolean {
  const last = metaGet(K_LAST_RUN);
  if (!last) return true;
  const lastMs = Date.parse(last);
  if (Number.isNaN(lastMs)) return true;
  return Date.now() - lastMs >= getBackupIntervalHours() * HOUR_MS;
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Starts the background backup loop — checks every 15 minutes whether the
 * configured interval has elapsed, and if so runs a backup. Idempotent:
 * calling twice does not start a second loop.
 */
export function startBackupScheduler(): () => void {
  if (intervalHandle) return stopBackupScheduler;
  const tick = () => {
    if (dueNow())
      void runBackupNow().catch((err) => console.error("[backup] auto run failed:", err));
  };
  tick(); // catch up immediately if overdue (e.g. app was closed past the interval)
  intervalHandle = setInterval(tick, 15 * 60_000);
  return stopBackupScheduler;
}

export function stopBackupScheduler(): void {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
}

export function listBackups(): AutoBackupEntry[] {
  return listAutoBackups();
}
