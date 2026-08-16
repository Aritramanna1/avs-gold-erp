import { getCloudDataClient as getRawSupabaseClient } from "@/lib/providers/data-provider";
import { reportUnexpectedError } from "@/lib/error-handling";
import { deleteDirect, saveDirect } from "@/lib/supabase-write";

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
  "metal_conversions",
  "workshop_process_transactions",
  "customer_gold_deposits",
]);

const COMPATIBILITY_READ_LIMIT = 1000;

export interface Repository<T extends { id: string }> {
  save(payload: T): Promise<T>;
  delete(id: string): Promise<void>;
  saveAs(id: string, payload: unknown): Promise<void>;
  read(id: string): Promise<T | null>;
  readAll(): Promise<T[]>;
  getChangedSince(sinceIso: string): Promise<T[]>;
}

function fromDbRow<T>(row: Record<string, unknown> | null): T | null {
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

function updatedAtOf(row: unknown): string | null {
  if (!row || typeof row !== "object") return null;
  const value =
    (row as Record<string, unknown>).updatedAt ??
    (row as Record<string, unknown>).updated_at ??
    (row as Record<string, unknown>).createdAt ??
    (row as Record<string, unknown>).created_at;
  return typeof value === "string" ? value : null;
}

async function recordAuditBestEffort(
  table: string,
  action: "save" | "delete",
  entityId: string,
  after: unknown,
): Promise<void> {
  if (!AUDITED_TABLES.has(table)) return;
  try {
    const [{ append }, { supabase }] = await Promise.all([
      import("@/lib/security/audit-log"),
      import("@/lib/providers/data-provider"),
    ]);
    const { data } = await supabase.auth.getSession();
    await append({
      actorId: data.session?.user.id ?? null,
      actorEmail: data.session?.user.email ?? null,
      action: `${table}.${action}`,
      entityType: table,
      entityId,
      before: null,
      after,
      deviceId: "supabase-online",
    });
  } catch (err) {
    console.error(`[AuditLog] Failed to record ${action} on ${table}/${entityId}:`, err);
  }
}

function userSafeThrow(error: unknown, context: string): never {
  const normalized = reportUnexpectedError(error, context);
  throw new Error(`${normalized.message} Reference: ${normalized.id}`);
}

function wrapRepository<T extends { id: string }>(
  table: string,
  repository: Repository<T>,
): Repository<T> {
  return new Proxy(repository, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        try {
          const result = value.apply(target, args);
          if (result && typeof result.then === "function") {
            return result.catch((error: unknown) =>
              userSafeThrow(error, `repository.${table}.${String(prop)}`),
            );
          }
          return result;
        } catch (error) {
          userSafeThrow(error, `repository.${table}.${String(prop)}`);
        }
      };
    },
  }) as Repository<T>;
}

/**
 * Supabase-online repository.
 *
 * Use `save`, `delete`, `read`, and `readAll` for all business state. There is
 * no browser-local repository/outbox path in production.
 */
export function createRepository<T extends { id: string }>(table: string): Repository<T> {
  const repository: Repository<T> = {
    async save(payload) {
      await saveDirect(table, payload.id, payload);
      void recordAuditBestEffort(table, "save", payload.id, payload);
      return payload;
    },

    async delete(id) {
      await deleteDirect(table, id);
      void recordAuditBestEffort(table, "delete", id, null);
    },

    async saveAs(id, payload) {
      await saveDirect(table, id, payload);
      void recordAuditBestEffort(table, "save", id, payload);
    },

    async read(id) {
      const client = getRawSupabaseClient();
      const { data, error } = await client
        .from(table as any)
        .select("id, data")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) return null;
      return fromDbRow<T>(data as unknown as Record<string, unknown>);
    },

    async readAll() {
      const client = getRawSupabaseClient();
      // Transitional compatibility path only. High-volume screens must use a
      // route-specific Supabase query/RPC with filters, counts, and pagination.
      const { data, error } = await client
        .from(table as any)
        .select("data")
        .limit(COMPATIBILITY_READ_LIMIT);
      if (error) return [];
      return ((data ?? []) as unknown[])
        .map((row) => fromDbRow<T>(row as Record<string, unknown>))
        .filter((row): row is T => row !== null);
    },

    async getChangedSince(sinceIso) {
      const rows = await this.readAll();
      return rows
        .filter((row) => {
          const updatedAt = updatedAtOf(row);
          return updatedAt !== null && updatedAt > sinceIso;
        })
        .sort((a, b) => (updatedAtOf(a) ?? "").localeCompare(updatedAtOf(b) ?? ""));
    },
  };
  return wrapRepository(table, repository);
}
