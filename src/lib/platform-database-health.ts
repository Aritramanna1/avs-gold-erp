/**
 * Platform Owner database health — live PostgreSQL + telemetry via RPC.
 * saas_admin only; never exposed to tenant ERP surfaces.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export interface PlatformTableStat {
  table: string;
  live_rows: number;
  size_bytes: number;
}

export interface PlatformRateLimitBucket {
  bucket: string;
  users: number;
  hits: number;
}

export interface PlatformErrorCategoryStat {
  category: string;
  count: number;
  critical: number;
}

export interface PlatformDatabaseHealthSnapshot {
  ok: boolean;
  checked_at: string;
  ping_ms: number;
  database_size_bytes: number;
  active_connections: number;
  errors_last_1h: number;
  errors_last_24h: number;
  critical_errors_last_24h: number;
  errors_by_category_24h: PlatformErrorCategoryStat[];
  total_organizations: number;
  active_organizations: number;
  active_subscriptions: number;
  rate_limit_buckets: PlatformRateLimitBucket[];
  largest_tables: PlatformTableStat[];
}

export interface PlatformEgressObservabilitySnapshot {
  ok: boolean;
  checked_at: string;
  query_ms: number;
  rate_limit_total_hits: number;
  rate_limit_distinct_users: number;
  rate_limit_buckets: Array<PlatformRateLimitBucket & { window_start?: string }>;
  error_events_by_hour_24h: Array<{ hour: string; count: number; critical: number }>;
  postgres_related_errors_24h: Array<{
    message: string;
    category: string;
    severity: string;
    created_at: string;
  }>;
  note?: string;
}

export interface PlatformClientEgressSnapshot {
  loginBoot: {
    totalRequests: number;
    authRequests: number;
    restRequests: number;
    storageRequests: number;
    realtimeEvents: number;
    dedupedRequests: number;
    blockedRequests: number;
    totalBytes: number;
    durationMs: number | null;
  } | null;
  sessionTotals: {
    totalRequests: number;
    blockedRequests: number;
    dedupedRequests: number;
    totalBytes: number;
  } | null;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export async function fetchPlatformDatabaseHealth(): Promise<PlatformDatabaseHealthSnapshot | null> {
  const { data, error } = await (supabase as any).rpc("get_platform_database_health");
  if (error) {
    console.warn("[platform-health] get_platform_database_health:", error.message);
    return null;
  }
  const row = data as Record<string, unknown>;
  return {
    ok: Boolean(row.ok),
    checked_at: String(row.checked_at ?? ""),
    ping_ms: Number(row.ping_ms ?? 0),
    database_size_bytes: Number(row.database_size_bytes ?? 0),
    active_connections: Number(row.active_connections ?? 0),
    errors_last_1h: Number(row.errors_last_1h ?? 0),
    errors_last_24h: Number(row.errors_last_24h ?? 0),
    critical_errors_last_24h: Number(row.critical_errors_last_24h ?? 0),
    errors_by_category_24h: asArray(row.errors_by_category_24h),
    total_organizations: Number(row.total_organizations ?? 0),
    active_organizations: Number(row.active_organizations ?? 0),
    active_subscriptions: Number(row.active_subscriptions ?? 0),
    rate_limit_buckets: asArray(row.rate_limit_buckets),
    largest_tables: asArray(row.largest_tables),
  };
}

export async function fetchPlatformEgressObservability(): Promise<PlatformEgressObservabilitySnapshot | null> {
  const { data, error } = await (supabase as any).rpc("get_platform_egress_observability");
  if (error) {
    console.warn("[platform-health] get_platform_egress_observability:", error.message);
    return null;
  }
  const row = data as Record<string, unknown>;
  return {
    ok: Boolean(row.ok),
    checked_at: String(row.checked_at ?? ""),
    query_ms: Number(row.query_ms ?? 0),
    rate_limit_total_hits: Number(row.rate_limit_total_hits ?? 0),
    rate_limit_distinct_users: Number(row.rate_limit_distinct_users ?? 0),
    rate_limit_buckets: asArray(row.rate_limit_buckets),
    error_events_by_hour_24h: asArray(row.error_events_by_hour_24h),
    postgres_related_errors_24h: asArray(row.postgres_related_errors_24h),
    note: typeof row.note === "string" ? row.note : undefined,
  };
}

/** Owner-console only: read client egress instrumentation if present in this browser session. */
export function readPlatformClientEgressSnapshot(): PlatformClientEgressSnapshot {
  if (typeof window === "undefined") {
    return { loginBoot: null, sessionTotals: null };
  }
  const api = (
    window as unknown as {
      __ORNEXA_EGRESS__?: {
        loginSummary?: () => Record<string, unknown>;
        snapshot?: () => Record<string, unknown>;
      };
    }
  ).__ORNEXA_EGRESS__;
  if (!api?.snapshot) return { loginBoot: null, sessionTotals: null };
  const login = api.loginSummary?.() ?? null;
  const snap = api.snapshot?.() ?? null;
  return {
    loginBoot: login
      ? {
          totalRequests: Number(login.totalRequests ?? 0),
          authRequests: Number(login.authRequests ?? 0),
          restRequests: Number(login.restRequests ?? 0),
          storageRequests: Number(login.storageRequests ?? 0),
          realtimeEvents: Number(login.realtimeEvents ?? 0),
          dedupedRequests: Number(login.dedupedRequests ?? 0),
          blockedRequests: Number(login.blockedRequests ?? 0),
          totalBytes: Number(login.totalBytes ?? 0),
          durationMs: login.durationMs != null ? Number(login.durationMs) : null,
        }
      : null,
    sessionTotals: snap
      ? {
          totalRequests: Number(snap.totalRequests ?? 0),
          blockedRequests: Number(snap.blockedRequests ?? 0),
          dedupedRequests: Number(snap.dedupedRequests ?? 0),
          totalBytes: Number(snap.totalBytes ?? 0),
        }
      : null,
  };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
