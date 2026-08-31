/**
 * Supabase-online synchronization facade.
 *
 * Ornexa production no longer uses the legacy local SQLite outbox or hybrid
 * cache hydration path. This module keeps the old public API stable for
 * settings/notification surfaces while making every operation explicitly
 * Supabase-online and non-local.
 */

export interface PushResult {
  pushed: number;
  conflicts: number;
  failed: number;
  skippedNotDue: number;
}

export interface PullResult {
  table: string;
  fetched: number;
  since: string | null;
}

export interface SyncStatus {
  pending: number;
  conflicts: number;
  failed: number;
  synced: number;
  lastPushedAt: string | null;
  lastPulledAtByTable: Record<string, string | null>;
}

export async function pushPendingOutbox(): Promise<PushResult> {
  return { pushed: 0, conflicts: 0, failed: 0, skippedNotDue: 0 };
}

export async function pullChangesSince(table: string): Promise<PullResult> {
  return { table, fetched: 0, since: null };
}

export function getSyncStatus(): SyncStatus {
  return {
    pending: 0,
    conflicts: 0,
    failed: 0,
    synced: 0,
    lastPushedAt: null,
    lastPulledAtByTable: {},
  };
}

export function getUnresolvedConflicts(): {
  id: string;
  table_name: string;
  row_id: string;
  local_payload: unknown;
  remote_payload: unknown;
  detected_at: string;
}[] {
  return [];
}

export async function resolveConflict(
  _conflictId: string,
  _resolution: "local" | "remote",
): Promise<void> {
  return;
}

export function startSyncOutboxScheduler(_intervalMs = 15_000): () => void {
  return () => stopSyncOutboxScheduler();
}

export function stopSyncOutboxScheduler(): void {
  return;
}
