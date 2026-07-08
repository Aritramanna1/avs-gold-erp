import { saveDirect, deleteDirect } from "@/lib/supabase-write";
import { getRawSupabaseClient } from "@/integrations/supabase/client";
import {
  runLocal,
  upsertRow,
  bulkUpsertRows,
  softDeleteRow,
  undeleteRow,
  selectById,
  selectAllLive,
  enqueueOutbox,
  extractUpdatedAt,
} from "@/lib/local-db";
import { pullChangesSince } from "@/lib/sync-engine";
import { getOrCreateDeviceId } from "@/lib/security/device-registry";

/**
 * Tables whose writes represent a financial or gold-accounting action and
 * therefore get an automatic, best-effort audit log entry (Plan 1 Step 8) on
 * every save/delete — in addition to whatever explicit audit calls a
 * specific business flow already makes. Deliberately best-effort (caught,
 * logged to console, never thrown) here: this generic repository layer is
 * shared by 28 tables with years of validated behavior behind it, and this
 * pass's job is to add auditability without introducing a new failure mode
 * into stores that have nothing to do with security. A flow that needs a
 * HARD guarantee the audit entry was written (i.e. must throw on failure)
 * should call src/lib/security/audit-log.ts's `append()` directly instead of
 * relying on this best-effort hook.
 */
const AUDITED_TABLES = new Set([
  "invoices",
  "payments",
  "ledger_entries",
  "gold_settlements",
  "worker_transactions",
  "worker_settlements",
  "melt_jobs",
  "manufacturing_bills",
  "daily_close",
  "stock_movements",
]);
// Deliberately EXCLUDES "app_settings" — despite going through this same
// repository, app_settings holds configuration/preferences (comm provider
// config, WhatsApp templates, automation rules, expenses-store scratch
// state), not a financial/gold/inventory/permission action, and it is
// written far more frequently (branch selection, default-settings
// bootstrapping on nearly every login) than the genuinely audited tables
// above. Including it forced a full local SQLite/WASM initialization as a
// side effect of routine app boot on every session — a real, measured
// performance regression (see local-db.ts's initLocalDb() timing) that
// showed up as widespread Playwright timeouts unrelated to any of the
// tables actually being tested. Removing it fixes that without weakening
// the audit trail's actual purpose.

/**
 * Fire-and-forget: fetches the pre-write local snapshot (if any) itself,
 * rather than requiring callers to pre-fetch it, so a local-db access error
 * (e.g. not yet initialized in a session that never touched local storage
 * before) can never propagate into the actual save()/delete() call it's
 * documenting — it's caught here and logged, same as every other failure
 * mode in this function.
 */
async function recordAuditBestEffort(
  table: string,
  action: "save" | "delete",
  entityId: string,
  after: unknown,
): Promise<void> {
  if (!AUDITED_TABLES.has(table)) return;
  try {
    const [{ append }, { supabase }, deviceId] = await Promise.all([
      import("@/lib/security/audit-log"),
      import("@/integrations/supabase/client"),
      getOrCreateDeviceId(),
    ]);
    let before: unknown = null;
    try {
      const { initLocalDb } = await import("@/lib/local-db");
      await initLocalDb();
      before = fromLocalRow(selectById(table, entityId));
    } catch {
      // Local DB unavailable — audit entry is still recorded, just without
      // a "before" snapshot.
    }
    const { data } = await supabase.auth.getSession();
    await append({
      actorId: data.session?.user.id ?? null,
      actorEmail: data.session?.user.email ?? null,
      action: `${table}.${action}`,
      entityType: table,
      entityId,
      before,
      after,
      deviceId,
    });
  } catch (err) {
    console.error(`[AuditLog] Failed to record ${action} on ${table}/${entityId}:`, err);
  }
}

/**
 * Repository Layer — Plan 1, Step 1 (offline-first migration).
 *
 * Every Zustand store's mutation handlers call a repository's save()/delete()
 * instead of saveDirect()/deleteDirect() directly. Today this is a pure
 * pass-through wrapper with zero behavior change (still writes straight to
 * Supabase) — it exists so the storage engine underneath can be swapped for
 * local SQLite + a sync outbox later without touching any store's call sites
 * again. See C:\Users\aritr\.claude\plans\hashed-churning-rocket.md (Plan 1).
 *
 * Plan 1 Step 3 (Local Write Engine) adds the *Local methods below. They are
 * NOT called by any store yet — stores still exclusively use save()/delete()/
 * saveAs(), which remain Supabase-only. The *Local methods exist so Step 4's
 * sync engine (and later, Step 5's read-switch) have a tested, atomic local
 * write path to build on, without touching store call sites again.
 *
 * Local row shape: every local-db table has at minimum `id` + `data` columns
 * (see local-db.ts's createTables()) — the repository stores the FULL domain
 * object as `data` (JSON) uniformly across all tables, rather than trying to
 * populate each table's extra structured/indexed columns from here. Those
 * structured columns exist for Step 5's local reads (fast filtered/indexed
 * queries) and get populated when that read path is built; until then they
 * simply stay empty, which is harmless since nothing reads them yet.
 * Critically, the OUTBOX always carries the plain, unwrapped domain object
 * (never the {id, data} local-row wrapper) — so when Step 4's sync engine
 * pushes it via saveDirect(), that function's existing per-table mapping
 * (see supabase-write.ts) applies exactly once, matching what a direct
 * save() call would have produced.
 */
export interface Repository<T extends { id: string }> {
  save(payload: T): Promise<T>;
  delete(id: string): Promise<void>;
  /**
   * For tables keyed by a fixed/external id where the payload itself has no
   * `id` field (e.g. a single settings-blob row like app_settings' scoped
   * config rows) — saves `payload` under `id` without injecting an `id`
   * property into the stored payload, so the row shape matches exactly what
   * direct saveDirect(table, id, payload) calls wrote before this repository
   * layer existed.
   */
  saveAs(id: string, payload: unknown): Promise<void>;

  // ---- Local Write Engine (Plan 1 Step 3) ----

  /** Atomic local insert/update, keyed by payload.id. Enqueues an outbox entry for future sync. */
  saveLocal(payload: T): Promise<T>;
  /** Reads the current local row, merges `patch`, and saves atomically. No-ops if the row doesn't exist locally. */
  updateLocal(id: string, patch: Partial<T>): Promise<T | null>;
  /** Soft-deletes locally (row stays physically present for FK integrity + undo) and enqueues an outbox delete. */
  deleteLocal(id: string): Promise<void>;
  /** Reverses a not-yet-synced local soft delete. */
  undeleteLocal(id: string): Promise<void>;
  /**
   * Saves every row in `payloads` inside ONE transaction — either all rows
   * commit or none do (rollback on any failure), and one outbox entry is
   * enqueued per row. Use for multi-row operations (e.g. bulk import) where
   * partial application would leave inconsistent state.
   */
  bulkSaveLocal(payloads: T[]): Promise<T[]>;
  /** Local row by id, or null if absent/soft-deleted. */
  getLocalById(id: string): Promise<T | null>;
  /** All non-soft-deleted local rows for this table. */
  getAllLocal(): Promise<T[]>;

  // ---- Local Read Engine (Plan 1 Step 5) ----

  /**
   * Reads a single row local-first: if a local copy exists, returns it
   * immediately (works fully offline). If nothing local exists yet AND the
   * network is reachable, falls back to a direct Supabase fetch and
   * opportunistically caches the result locally for next time — so a
   * genuinely offline app never blocks on a network call it can't complete,
   * while a fresh/never-synced table still resolves online. Returns null if
   * absent both locally and remotely (or offline with nothing cached).
   */
  read(id: string): Promise<T | null>;
  /**
   * Reads all rows local-first. If local has never been populated for this
   * table (e.g. first run before any sync) and the network is reachable,
   * pulls once from Supabase and serves from the now-populated local cache.
   * Offline with an empty local cache returns an empty array rather than
   * throwing — callers should treat that as "nothing synced yet", not
   * "table is empty", and the UI is responsible for surfacing that
   * distinction if needed.
   */
  readAll(): Promise<T[]>;

  // ---- Portal/API readiness (future online ecosystem — Customer/Dealer/
  // Karigar portals, Internal Management portal, future mobile apps) ----

  /**
   * Every non-deleted local row updated strictly after `sinceIso` (an ISO
   * timestamp), sorted oldest-first. This is the exact `getChangedSince`
   * shape Plan 1's architecture doc calls for on every repository — the
   * same incremental-delta mechanism sync-engine.ts already uses
   * internally (pullChangesSince) to keep local SQLite in sync with
   * Supabase, now exposed on the repository itself so a FUTURE consumer
   * (a portal's own sync job, a mobile app, an HTTP API wrapper) can ask
   * "what changed since I last checked" through the same interface the
   * desktop app already relies on — one implementation, multiple
   * transports, no portal-specific sync logic to build or maintain
   * separately. Falls back to an empty array (not a throw) if the local
   * table has never been populated — "nothing synced yet" is the same
   * shape as "nothing changed," and callers already have to handle both.
   */
  getChangedSince(sinceIso: string): Promise<T[]>;
}

/** Wraps a domain object into this table's minimal local-row shape. */
function toLocalRow<T extends { id: string }>(payload: T): Record<string, unknown> {
  return { id: payload.id, data: JSON.stringify(payload) };
}

/**
 * Unwraps a local-row record back into its domain object shape. local-db.ts's
 * selectById/selectAllLive (via normalizeRow) already JSON.parse the `data`
 * column for us, so `row.data` is typically already an object here — only
 * parse it ourselves if it somehow arrives as a raw string.
 */
function fromLocalRow<T>(row: Record<string, unknown> | null): T | null {
  if (!row) return null;
  const raw = row.data;
  if (raw && typeof raw === "object") return raw as T;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return row as unknown as T;
    }
  }
  return row as unknown as T;
}

export function createRepository<T extends { id: string }>(table: string): Repository<T> {
  return {
    async save(payload: T): Promise<T> {
      await saveDirect(table, payload.id, payload);
      void recordAuditBestEffort(table, "save", payload.id, payload);
      return payload;
    },
    async delete(id: string): Promise<void> {
      await deleteDirect(table, id);
      void recordAuditBestEffort(table, "delete", id, null);
    },
    async saveAs(id: string, payload: unknown): Promise<void> {
      await saveDirect(table, id, payload);
      void recordAuditBestEffort(table, "save", id, payload);
    },

    async saveLocal(payload: T): Promise<T> {
      await runLocal(() => {
        const before = fromLocalRow<T>(selectById(table, payload.id));
        undeleteRow(table, payload.id); // saving over a pending-delete row cancels the delete
        upsertRow(table, toLocalRow(payload));
        enqueueOutbox(
          `${table}:${payload.id}:${Date.now()}`,
          table,
          payload.id,
          "insert",
          payload,
          extractUpdatedAt(before as Record<string, unknown> | null),
        );
      });
      return payload;
    },

    async updateLocal(id: string, patch: Partial<T>): Promise<T | null> {
      return runLocal(() => {
        const current = fromLocalRow<T>(selectById(table, id));
        if (!current) return null;
        const updated = { ...current, ...patch, id } as T;
        upsertRow(table, toLocalRow(updated));
        enqueueOutbox(
          `${table}:${id}:${Date.now()}`,
          table,
          id,
          "update",
          updated,
          extractUpdatedAt(current as unknown as Record<string, unknown>),
        );
        return updated;
      });
    },

    async deleteLocal(id: string): Promise<void> {
      await runLocal(() => {
        const before = fromLocalRow<T>(selectById(table, id));
        softDeleteRow(table, id);
        enqueueOutbox(
          `${table}:${id}:${Date.now()}`,
          table,
          id,
          "delete",
          null,
          extractUpdatedAt(before as Record<string, unknown> | null),
        );
      });
    },

    async undeleteLocal(id: string): Promise<void> {
      await runLocal(() => {
        undeleteRow(table, id);
      });
    },

    async bulkSaveLocal(payloads: T[]): Promise<T[]> {
      await runLocal(() => {
        const beforeById = new Map(
          payloads.map((p) => [p.id, fromLocalRow<T>(selectById(table, p.id))]),
        );
        bulkUpsertRows(
          table,
          payloads.map((p) => toLocalRow(p)),
        );
        for (const p of payloads) {
          undeleteRow(table, p.id);
          enqueueOutbox(
            `${table}:${p.id}:${Date.now()}`,
            table,
            p.id,
            "insert",
            p,
            extractUpdatedAt(beforeById.get(p.id) as unknown as Record<string, unknown> | null),
          );
        }
      });
      return payloads;
    },

    async getLocalById(id: string): Promise<T | null> {
      return fromLocalRow<T>(selectById(table, id));
    },

    async getAllLocal(): Promise<T[]> {
      return selectAllLive(table)
        .map((row) => fromLocalRow<T>(row))
        .filter((row): row is T => row !== null);
    },

    async read(id: string): Promise<T | null> {
      const local = fromLocalRow<T>(selectById(table, id));
      if (local) return local;
      if (typeof navigator !== "undefined" && navigator.onLine === false) return null;
      try {
        const client = getRawSupabaseClient();
        const { data, error } = await client
          .from(table as any)
          .select("id, data")
          .eq("id", id)
          .maybeSingle();
        if (error || !data) return null;
        const remote = ((data as unknown) as { id: string; data: T }).data;
        await runLocal(() => upsertRow(table, { id, data: JSON.stringify(remote) }));
        return remote;
      } catch {
        // Network unreachable despite navigator.onLine === true (a common
        // false-positive) — treat exactly like the offline-with-nothing-
        // cached case rather than throwing and breaking the caller's UI.
        return null;
      }
    },

    async readAll(): Promise<T[]> {
      const local = await this.getAllLocal();
      if (local.length > 0) return local;
      if (typeof navigator !== "undefined" && navigator.onLine === false) return [];
      try {
        await pullChangesSince(table);
        return this.getAllLocal();
      } catch {
        return [];
      }
    },

    async getChangedSince(sinceIso: string): Promise<T[]> {
      const rows = selectAllLive(table)
        .map((row) => fromLocalRow<T>(row))
        .filter((parsed): parsed is T => parsed !== null)
        .filter((parsed) => {
          const updatedAt = extractUpdatedAt(parsed as unknown as Record<string, unknown>);
          return updatedAt !== null && updatedAt > sinceIso;
        })
        .sort((a, b) =>
          (extractUpdatedAt(a as unknown as Record<string, unknown>) ?? "").localeCompare(
            extractUpdatedAt(b as unknown as Record<string, unknown>) ?? "",
          ),
        );
      return rows;
    },
  };
}
