import { getCloudDataClient } from "@/lib/providers/data-provider";
import type { FinancialLockPeriod } from "@/lib/financial-lock-store";

const FINANCIAL_LOCK_READ_LIMIT = 500;

function fromData(row: Record<string, unknown> | null): FinancialLockPeriod | null {
  if (!row) return null;
  const raw = row.data;
  if (raw && typeof raw === "object") return raw as FinancialLockPeriod;
  return null;
}

export async function fetchFinancialLocks(
  options: {
    branchId?: string;
    period?: string;
    limit?: number;
  } = {},
): Promise<FinancialLockPeriod[]> {
  const db = getCloudDataClient();
  let query = db
    .from("financial_lock_periods")
    .select("data")
    .order("period", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(options.limit ?? FINANCIAL_LOCK_READ_LIMIT);

  if (options.branchId) query = query.eq("branch_id", options.branchId);
  if (options.period) query = query.eq("period", options.period);

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown[])
    .map((row) => fromData(row as Record<string, unknown>))
    .filter((row): row is FinancialLockPeriod => row !== null)
    .sort((a, b) => b.period.localeCompare(a.period) || b.lockedAt - a.lockedAt);
}
