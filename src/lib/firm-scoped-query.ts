/**
 * Firm-scoped Supabase query helpers — every operational table pull must filter
 * by firm_id so RLS + indexes evaluate on a bounded slice, not a cross-tenant scan.
 */
import { resolveCurrentFirmId } from "@/lib/firm-scoped-app-settings";

export async function resolveFirmIdForQuery(): Promise<string | null> {
  return resolveCurrentFirmId().catch(() => null);
}

/** Apply firm_id equality when known; callers should no-op when null. */
export function withFirmScope<T extends { eq: (column: string, value: string) => T }>(
  query: T,
  firmId: string | null,
): T {
  if (!firmId) return query;
  return query.eq("firm_id", firmId);
}
