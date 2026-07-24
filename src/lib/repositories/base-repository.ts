import { saveDirect, deleteDirect } from "@/lib/supabase-write";
import { getCloudDataClient } from "@/lib/providers/data-provider";
import { reportUnexpectedError } from "@/lib/error-handling";

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

async function recordAuditBestEffort(
  table: string,
  action: "save" | "delete",
  entityId: string,
  after: unknown,
): Promise<void> {
  if (!AUDITED_TABLES.has(table)) return;
  try {
    const [{ append }, supabase] = await Promise.all([
      import("@/lib/security/audit-log"),
      Promise.resolve(getCloudDataClient()),
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
      deviceId: null,
    });
  } catch (error) {
    console.error(`[AuditLog] Failed to record ${action} on ${table}/${entityId}:`, error);
  }
}

export interface Repository<T extends { id: string }> {
  save(payload: T): Promise<T>;
  delete(id: string): Promise<void>;
  saveAs(id: string, payload: unknown): Promise<void>;
  /** Compatibility names retained for callers; all operations are cloud-backed. */
  saveLocal(payload: T): Promise<T>;
  updateLocal(id: string, patch: Partial<T>): Promise<T | null>;
  deleteLocal(id: string): Promise<void>;
  undeleteLocal(id: string): Promise<void>;
  bulkSaveLocal(payloads: T[]): Promise<T[]>;
  getLocalById(id: string): Promise<T | null>;
  getAllLocal(): Promise<T[]>;
  read(id: string): Promise<T | null>;
  readAll(): Promise<T[]>;
  getChangedSince(sinceIso: string): Promise<T[]>;
}

function unwrap<T>(row: { data?: unknown } | null): T | null {
  if (!row) return null;
  if (row.data && typeof row.data === "object") return row.data as T;
  if (typeof row.data === "string") {
    try {
      return JSON.parse(row.data) as T;
    } catch {
      return null;
    }
  }
  return row as T;
}

function safe<T extends { id: string }>(table: string, repository: Repository<T>): Repository<T> {
  return new Proxy(repository, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        try {
          const result = value.apply(target, args);
          return result && typeof result.then === "function"
            ? result.catch((error: unknown) => {
                const normalized = reportUnexpectedError(
                  error,
                  `repository.${table}.${String(property)}`,
                );
                throw new Error(`${normalized.message} Reference: ${normalized.id}`);
              })
            : result;
        } catch (error) {
          const normalized = reportUnexpectedError(
            error,
            `repository.${table}.${String(property)}`,
          );
          throw new Error(`${normalized.message} Reference: ${normalized.id}`);
        }
      };
    },
  }) as Repository<T>;
}

export function createRepository<T extends { id: string }>(table: string): Repository<T> {
  const cloud = getCloudDataClient;
  const read = async (id: string): Promise<T | null> => {
    const { data, error } = await cloud()
      .from(table as any)
      .select("id, data")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return unwrap<T>(data as { data?: unknown } | null);
  };
  const readAll = async (): Promise<T[]> => {
    const { data, error } = await cloud()
      .from(table as any)
      .select("id, data")
      .limit(10000);
    if (error) throw error;
    return ((data ?? []) as Array<{ data?: unknown }>)
      .map((row) => unwrap<T>(row))
      .filter((row): row is T => row !== null);
  };
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
    saveLocal(payload) {
      return this.save(payload);
    },
    async updateLocal(id, patch) {
      const current = await read(id);
      if (!current) return null;
      const updated = { ...current, ...patch, id } as T;
      await this.save(updated);
      return updated;
    },
    deleteLocal(id) {
      return this.delete(id);
    },
    async undeleteLocal(_id) {
      // Soft deletes are not part of the web data model.
    },
    async bulkSaveLocal(payloads) {
      for (const payload of payloads) await this.save(payload);
      return payloads;
    },
    getLocalById: read,
    getAllLocal: readAll,
    read,
    readAll,
    async getChangedSince(sinceIso) {
      const { data, error } = await cloud()
        .from(table as any)
        .select("id, data, updated_at")
        .gt("updated_at", sinceIso)
        .order("updated_at", { ascending: true })
        .limit(10000);
      if (error) throw error;
      return ((data ?? []) as Array<{ data?: unknown }>)
        .map((row) => unwrap<T>(row))
        .filter((row): row is T => row !== null);
    },
  };
  return safe(table, repository);
}
