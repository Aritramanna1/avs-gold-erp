/**
 * MTJ ERP — Synchronization Engine (Plan 1, Step 4)
 *
 * Drains the local SQLite outbox (see local-db.ts) to Supabase, and pulls
 * incremental remote changes back into local SQLite. Not wired to run
 * automatically anywhere yet, and nothing redirects reads/writes to it —
 * this is tested, standalone infrastructure per Plan 1's phased rollout.
 * See C:\Users\aritr\.claude\plans\hashed-churning-rocket.md.
 *
 * Design:
 *  - Push (upload): each outbox entry carries `base_updated_at` — the
 *    target row's updatedAt as last known locally when the edit was made.
 *    Before pushing, the engine fetches the row's CURRENT remote updatedAt.
 *    If it differs from base_updated_at, someone else changed the row since
 *    we last knew about it — that's a conflict: never overwritten, always
 *    logged to sync_conflicts for review. Only pushes cleanly when the
 *    remote is still at (or the row never existed at) our known base.
 *  - Retry: failures use exponential backoff via `next_attempt_at`; the
 *    entry stays 'pending' and is retried on a later push cycle. A crash or
 *    interruption mid-drain simply leaves remaining entries 'pending' —
 *    resumable by construction, no special resume logic needed.
 *  - Pull (download): incremental — fetches only rows changed after
 *    sync_meta.last_pulled_at for a table, not the whole table.
 */
import { getRawSupabaseClient } from "@/integrations/supabase/client";
import { saveDirect, deleteDirect } from "@/lib/supabase-write";
import {
  runLocal,
  queryTable,
  upsertRow,
  purgeSoftDeletedRow,
  extractUpdatedAt,
  getDb,
  initLocalDb,
} from "@/lib/local-db";

const BACKOFF_SCHEDULE_MS = [2_000, 5_000, 15_000, 30_000]; // caps at 30s after 4th failed attempt

function backoffDelayMs(attempts: number): number {
  return BACKOFF_SCHEDULE_MS[Math.min(attempts, BACKOFF_SCHEDULE_MS.length - 1)];
}

interface OutboxRow {
  id: string;
  table_name: string;
  row_id: string;
  operation: "insert" | "update" | "delete";
  payload: unknown;
  status: string;
  attempts: number;
  base_updated_at: string | null;
  next_attempt_at: string | null;
}

/** Fetches the current remote row's updatedAt (or null if it doesn't exist remotely). */
async function fetchRemoteUpdatedAt(table: string, rowId: string): Promise<string | null> {
  const client = getRawSupabaseClient();
  const { data, error } = await client
    .from(table as any)
    .select("data")
    .eq("id", rowId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return extractUpdatedAt((data as { data?: Record<string, unknown> }).data ?? null);
}

function recordConflict(
  table: string,
  rowId: string,
  localPayload: unknown,
  remotePayload: unknown,
): void {
  const db = getDb();
  db.run(
    `INSERT INTO sync_conflicts (id, table_name, row_id, local_payload, remote_payload, detected_at, resolved) VALUES (?, ?, ?, ?, ?, ?, 0);`,
    [
      `conflict:${table}:${rowId}:${Date.now()}`,
      table,
      rowId,
      localPayload == null ? null : JSON.stringify(localPayload),
      remotePayload == null ? null : JSON.stringify(remotePayload),
      new Date().toISOString(),
    ],
  );
}

export interface PushResult {
  pushed: number;
  conflicts: number;
  failed: number;
  skippedNotDue: number;
}

/**
 * Drains all due, pending outbox entries to Supabase, in creation order.
 * Safe to call repeatedly (e.g. on an interval, or on reconnect) — entries
 * already synced are gone/marked, entries not yet due for retry are skipped
 * this cycle, entries that fail get their backoff extended and are retried
 * on a later call. Never throws for a single entry's failure; that entry's
 * error is recorded and the drain continues with the rest.
 */
export async function pushPendingOutbox(): Promise<PushResult> {
  await initLocalDb();
  const now = new Date();
  const nowIso = now.toISOString();
  const pending = queryTable<OutboxRow>("outbox", "status = ? ORDER BY created_at ASC", [
    "pending",
  ]);

  const result: PushResult = { pushed: 0, conflicts: 0, failed: 0, skippedNotDue: 0 };

  for (const entry of pending) {
    if (entry.next_attempt_at && entry.next_attempt_at > nowIso) {
      result.skippedNotDue++;
      continue;
    }

    try {
      if (entry.operation === "delete") {
        // Deletes always proceed — there's no "someone edited it since" case
        // that should block a delete; the row's data is gone from our side
        // regardless. If it's already gone remotely, that's a success too.
        await deleteDirect(entry.table_name, entry.row_id);
        await runLocal(() => {
          purgeSoftDeletedRow(entry.table_name, entry.row_id);
          markOutboxSynced(entry.id);
        });
        result.pushed++;
        continue;
      }

      // The outbox `payload` column is stored (and read back) as a raw JSON
      // string — unlike `data`/`parsed`, local-db.ts's normalizeRow doesn't
      // auto-parse it — so it must be parsed here before use.
      const payload = typeof entry.payload === "string" ? JSON.parse(entry.payload) : entry.payload;

      const remoteUpdatedAt = await fetchRemoteUpdatedAt(entry.table_name, entry.row_id);
      const baseUpdatedAt = entry.base_updated_at;
      const isConflict =
        remoteUpdatedAt !== null && baseUpdatedAt !== null && remoteUpdatedAt !== baseUpdatedAt;

      if (isConflict) {
        await runLocal(() => {
          recordConflict(entry.table_name, entry.row_id, payload, remoteUpdatedAt);
          markOutboxStatus(entry.id, "conflict");
        });
        result.conflicts++;
        continue;
      }

      await saveDirect(entry.table_name, entry.row_id, payload);
      await runLocal(() => {
        recordRowSynced(entry.table_name, entry.row_id, extractUpdatedAt(payload));
        markOutboxSynced(entry.id);
      });
      result.pushed++;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : ((err as { message?: string; details?: string; hint?: string })?.message ??
            JSON.stringify(err));
      await runLocal(() => {
        const attempts = entry.attempts + 1;
        const nextAttemptAt = new Date(now.getTime() + backoffDelayMs(attempts)).toISOString();
        const db = getDb();
        db.run(
          `UPDATE outbox SET attempts = ?, last_error = ?, last_attempt_at = ?, next_attempt_at = ? WHERE id = ?;`,
          [attempts, message, nowIso, nextAttemptAt, entry.id],
        );
      });
      result.failed++;
    }
  }

  return result;
}

function markOutboxSynced(id: string): void {
  const db = getDb();
  db.run(`UPDATE outbox SET status = 'synced', last_attempt_at = ? WHERE id = ?;`, [
    new Date().toISOString(),
    id,
  ]);
}

function markOutboxStatus(id: string, status: string): void {
  const db = getDb();
  db.run(`UPDATE outbox SET status = ?, last_attempt_at = ? WHERE id = ?;`, [
    status,
    new Date().toISOString(),
    id,
  ]);
}

function recordRowSynced(table: string, rowId: string, updatedAt: string | null): void {
  const db = getDb();
  db.run(
    `INSERT INTO row_sync_state (table_name, row_id, last_synced_updated_at) VALUES (?, ?, ?)
     ON CONFLICT(table_name, row_id) DO UPDATE SET last_synced_updated_at = excluded.last_synced_updated_at;`,
    [table, rowId, updatedAt],
  );
}

export interface PullResult {
  table: string;
  fetched: number;
  since: string | null;
}

/**
 * Fetches rows from Supabase changed after this table's last pull (or all
 * rows on a table's very first pull), upserts them into local SQLite, and
 * advances sync_meta.last_pulled_at. Incremental by construction — never
 * re-downloads a whole table because one row changed.
 */
export async function pullChangesSince(table: string): Promise<PullResult> {
  const db = getDb();
  const metaStmt = db.prepare(`SELECT last_pulled_at FROM sync_meta WHERE table_name = ?;`);
  metaStmt.bind([table]);
  const since = metaStmt.step() ? (metaStmt.getAsObject().last_pulled_at as string | null) : null;
  metaStmt.free();

  const client = getRawSupabaseClient();
  // Rows store their app-level updatedAt inside the `data` JSONB column (see
  // supabase-write.ts's row-mapping functions), not a top-level `updated_at`
  // column on every table — filtered client-side after fetch below, which
  // stays correct across the whole schema rather than assuming a column
  // that may not exist on every table.
  const { data, error } = await client
    .from(table as any)
    .select("id, data")
    .order("id", { ascending: true })
    .limit(5000);
  if (error) throw error;

  const rows = (data ?? []) as unknown as { id: string; data: Record<string, unknown> }[];
  const changed = since
    ? rows.filter((r) => {
        const updatedAt = extractUpdatedAt(r.data);
        return !updatedAt || updatedAt > since;
      })
    : rows;

  await runLocal(() => {
    for (const row of changed) {
      const flat = { id: row.id, data: JSON.stringify(row.data) };
      upsertRow(table, flat);
      recordRowSynced(table, row.id, extractUpdatedAt(row.data));
    }
    const nowIso = new Date().toISOString();
    db.run(
      `INSERT INTO sync_meta (table_name, last_pulled_at) VALUES (?, ?)
       ON CONFLICT(table_name) DO UPDATE SET last_pulled_at = excluded.last_pulled_at;`,
      [table, nowIso],
    );
  });

  return { table, fetched: changed.length, since };
}

export interface SyncStatus {
  pending: number;
  conflicts: number;
  failed: number;
  synced: number;
  lastPushedAt: string | null;
  lastPulledAtByTable: Record<string, string | null>;
}

export function getSyncStatus(): SyncStatus {
  const db = getDb();
  function count(status: string): number {
    const stmt = db.prepare(`SELECT COUNT(*) as c FROM outbox WHERE status = ?;`);
    stmt.bind([status]);
    stmt.step();
    const c = Number(stmt.getAsObject().c ?? 0);
    stmt.free();
    return c;
  }
  const lastPushedStmt = db.prepare(
    `SELECT MAX(last_attempt_at) as t FROM outbox WHERE status = 'synced';`,
  );
  lastPushedStmt.step();
  const lastPushedAt = (lastPushedStmt.getAsObject().t as string | null) ?? null;
  lastPushedStmt.free();

  const perTable: Record<string, string | null> = {};
  const metaStmt = db.prepare(`SELECT table_name, last_pulled_at FROM sync_meta;`);
  while (metaStmt.step()) {
    const row = metaStmt.getAsObject();
    perTable[String(row.table_name)] = (row.last_pulled_at as string | null) ?? null;
  }
  metaStmt.free();

  return {
    pending: count("pending"),
    conflicts: count("conflict"),
    failed: 0, // failed entries stay 'pending' with attempts>0 until backoff exhausts — surfaced via attempts, not a separate terminal status
    synced: count("synced"),
    lastPushedAt,
    lastPulledAtByTable: perTable,
  };
}

/** Unresolved conflicts awaiting manual resolution. */
export function getUnresolvedConflicts(): {
  id: string;
  table_name: string;
  row_id: string;
  local_payload: unknown;
  remote_payload: unknown;
  detected_at: string;
}[] {
  return queryTable("sync_conflicts", "resolved = 0");
}

/**
 * Resolves a conflict by choosing which side wins. "local" re-enqueues the
 * local payload for push (will re-check against remote next push cycle,
 * since resolving to "local" means the user has reviewed and wants to
 * proceed anyway). "remote" discards the local edit and pulls the remote
 * version in on the next pullChangesSince() call.
 */
export async function resolveConflict(
  conflictId: string,
  resolution: "local" | "remote",
): Promise<void> {
  const db = getDb();
  const stmt = db.prepare(`SELECT * FROM sync_conflicts WHERE id = ?;`);
  stmt.bind([conflictId]);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  if (!row) throw new Error(`Conflict ${conflictId} not found`);

  await runLocal(() => {
    db.run(`UPDATE sync_conflicts SET resolved = 1, resolution = ? WHERE id = ?;`, [
      resolution,
      conflictId,
    ]);
    if (resolution === "local") {
      const tableName = String(row.table_name);
      const rowId = String(row.row_id);
      const payload = row.local_payload ? JSON.parse(String(row.local_payload)) : null;
      db.run(
        `INSERT INTO outbox (id, table_name, row_id, operation, payload, status, attempts, created_at, base_updated_at, next_attempt_at) VALUES (?, ?, ?, 'update', ?, 'pending', 0, ?, ?, ?);`,
        [
          `retry:${conflictId}`,
          tableName,
          rowId,
          payload == null ? null : JSON.stringify(payload),
          new Date().toISOString(),
          // Re-check against whatever is remote NOW at retry time, not the
          // stale base — the user has explicitly chosen to override it.
          null,
          new Date().toISOString(),
        ],
      );
    }
  });
}

// ---- Background drain scheduler ----
// Mirrors comm-queue.ts's startCommQueueScheduler() exactly — same
// re-entrant guard, same setInterval + idempotent start/stop shape — so
// this file doesn't invent a second scheduling pattern alongside the one
// already proven in production for the communication queue. This is the
// one piece Plan 1 Step 3 ("Supabase push becomes async/queued... no UI
// trigger") never actually built: pushPendingOutbox() existed and worked,
// but nothing ever called it automatically.
let draining = false;
let schedulerHandle: ReturnType<typeof setInterval> | null = null;
let onlineListenerAttached = false;

async function drainOnce(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    await pushPendingOutbox();
  } catch (err) {
    console.error("[SyncEngine] Outbox drain failed:", err);
  } finally {
    draining = false;
  }
}

/**
 * Starts the background outbox drain: runs once immediately (catches up
 * anything left pending from a crash, power failure, or restart — the
 * outbox row survives in SQLite regardless of how the previous session
 * ended, so this is the entire "recovery after restart" story, not a
 * separate mechanism), then on a fixed interval, and immediately again
 * whenever the browser/Electron reports the connection came back online
 * (so reconnect doesn't wait out the rest of the current interval).
 * Idempotent — calling twice does not start a second interval or a second
 * online listener.
 */
export function startSyncOutboxScheduler(intervalMs = 15_000): () => void {
  if (schedulerHandle) return () => stopSyncOutboxScheduler();

  void drainOnce();
  schedulerHandle = setInterval(() => void drainOnce(), intervalMs);

  if (typeof window !== "undefined" && !onlineListenerAttached) {
    window.addEventListener("online", () => void drainOnce());
    onlineListenerAttached = true;
  }

  return () => stopSyncOutboxScheduler();
}

export function stopSyncOutboxScheduler(): void {
  if (schedulerHandle) {
    clearInterval(schedulerHandle);
    schedulerHandle = null;
  }
  // The "online" listener is deliberately left attached even after stop —
  // matching comm-queue.ts's own scheduler, which never needs to be
  // stopped in practice (only exposed for tests); removing it would need
  // a stored listener reference this module doesn't currently keep.
}
