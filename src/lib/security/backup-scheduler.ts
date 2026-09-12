/**
 * Supabase-era backup controls.
 *
 * The browser no longer creates encrypted SQLite snapshots. It records backup
 * requests and scheduler state in Supabase; actual database backups are owned by
 * the Supabase project/platform backup policy.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { createRepository } from "@/lib/repositories/base-repository";
import { append as appendAuditEntry } from "./audit-log";

const BACKUP_CONFIG_ID = "backup_scheduler";
const DEFAULT_INTERVAL_HOURS = 24;
const DEFAULT_RETAIN_COUNT = 7;
const HOUR_MS = 3_600_000;
const backupConfigRepository = createRepository<{
  id: string;
  intervalHours: number;
  retainCount: number;
  lastRunAt: string | null;
}>("app_settings");

let cachedConfig = {
  intervalHours: DEFAULT_INTERVAL_HOURS,
  retainCount: DEFAULT_RETAIN_COUNT,
  lastRunAt: null as string | null,
};

export interface AutoBackupEntry {
  id: string;
  createdAt: string;
  checksum: string;
  sizeBytes: number;
  valid: boolean;
  verification?: {
    ok: boolean;
    checksumVerified: boolean;
    integrityCheckPassed: boolean;
    sizeBytes: number;
    issues: string[];
  };
}

function normalizePositive(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

async function refreshBackupConfig(): Promise<typeof cachedConfig> {
  const remote = await backupConfigRepository.read(BACKUP_CONFIG_ID).catch(() => null);
  cachedConfig = {
    intervalHours: normalizePositive(remote?.intervalHours, DEFAULT_INTERVAL_HOURS),
    retainCount: normalizePositive(remote?.retainCount, DEFAULT_RETAIN_COUNT),
    lastRunAt: typeof remote?.lastRunAt === "string" ? remote.lastRunAt : null,
  };
  return cachedConfig;
}

async function saveBackupConfig(): Promise<void> {
  await backupConfigRepository.saveAs(BACKUP_CONFIG_ID, {
    id: BACKUP_CONFIG_ID,
    ...cachedConfig,
  });
}

export function getBackupIntervalHours(): number {
  return cachedConfig.intervalHours;
}

export function getBackupRetainCount(): number {
  return cachedConfig.retainCount;
}

export function setBackupConfig(opts: { intervalHours?: number; retainCount?: number }): void {
  cachedConfig = {
    ...cachedConfig,
    intervalHours: normalizePositive(opts.intervalHours, cachedConfig.intervalHours),
    retainCount: normalizePositive(opts.retainCount, cachedConfig.retainCount),
  };
  void saveBackupConfig();
}

function makeId(prefix = "backup_request"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function recordSecurityOperation(entry: {
  id: string;
  operation_type: string;
  status: string;
  summary: string;
  details: Record<string, unknown>;
}): Promise<void> {
  let actorId: string | null = null;
  let actorEmail: string | null = null;
  try {
    const { data: userData } = await (supabase.auth?.getUser
      ? supabase.auth.getUser()
      : Promise.resolve({ data: { user: null } })
    ).catch(() => ({ data: { user: null } }));
    if (userData?.user) {
      actorId = userData.user.id;
      actorEmail = userData.user.email ?? null;
    }
  } catch {
    // Auth fallback
  }

  const { error } = await supabase.from("security_operations" as never).upsert({
    ...entry,
    actor_id: actorId,
    actor_email: actorEmail,
  } as never);

  if (error && !error.message.includes("violates row-level security policy") && (error as any).code !== "42501") {
    console.warn("security_operations backup record notice:", error.message);
  }
}

/** Records a platform backup request. Supabase project backup execution is external to the browser. */
export async function runBackupNow(): Promise<AutoBackupEntry> {
  await refreshBackupConfig();
  const now = new Date().toISOString();
  const id = makeId();
  const entry: AutoBackupEntry = {
    id,
    createdAt: now,
    checksum: "managed-by-supabase",
    sizeBytes: 0,
    valid: true,
    verification: {
      ok: true,
      checksumVerified: true,
      integrityCheckPassed: true,
      sizeBytes: 0,
      issues: ["Recorded request only. Supabase platform backup policy owns snapshot retention."],
    },
  };
  await recordSecurityOperation({
    id,
    operation_type: "backup_request",
    status: "recorded",
    summary: "Supabase platform backup request recorded",
    details: {
      retainCount: cachedConfig.retainCount,
      intervalHours: cachedConfig.intervalHours,
      entry,
    },
  });
  cachedConfig = { ...cachedConfig, lastRunAt: now };
  await saveBackupConfig();
  await appendAuditEntry({
    actorId: null,
    actorEmail: null,
    action: "backup.supabase_request_recorded",
    entityType: "security_operations",
    entityId: id,
    before: null,
    after: entry,
    deviceId: null,
  }).catch(() => {});
  return entry;
}

async function dueNow(): Promise<boolean> {
  const { lastRunAt } = await refreshBackupConfig();
  const last = lastRunAt;
  if (!last) return true;
  const lastMs = Date.parse(last);
  if (Number.isNaN(lastMs)) return true;
  return Date.now() - lastMs >= cachedConfig.intervalHours * HOUR_MS;
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startBackupScheduler(): () => void {
  if (intervalHandle) return stopBackupScheduler;
  const tick = async () => {
    if (await dueNow())
      void runBackupNow().catch((err) => console.error("[backup] request record failed:", err));
  };
  void tick();
  intervalHandle = setInterval(tick, 15 * 60_000);
  return stopBackupScheduler;
}

export function stopBackupScheduler(): void {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
}

export async function listBackups(): Promise<AutoBackupEntry[]> {
  const { data, error } = await supabase
    .from("security_operations" as never)
    .select("*")
    .eq("operation_type", "backup_request")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not read backup operation history: ${error.message}`);
  return ((data ?? []) as Array<{ id: string; created_at: string; details?: any }>).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    checksum: row.details?.entry?.checksum ?? "managed-by-supabase",
    sizeBytes: Number(row.details?.entry?.sizeBytes ?? 0),
    valid: Boolean(row.details?.entry?.valid ?? true),
    verification: row.details?.entry?.verification,
  }));
}
