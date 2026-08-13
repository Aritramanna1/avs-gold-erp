import { getCloudDataClient } from "@/lib/providers/data-provider";
import type { PhysicalStockCount, StockCountStatus } from "@/lib/physical-stock-verification-store";

const PHYSICAL_STOCK_COUNT_READ_LIMIT = 500;

function fromData(row: Record<string, unknown> | null): PhysicalStockCount | null {
  if (!row) return null;
  const raw = row.data;
  if (raw && typeof raw === "object") return raw as PhysicalStockCount;
  return null;
}

export async function fetchPhysicalStockCounts(
  options: {
    branchId?: string;
    status?: StockCountStatus;
    limit?: number;
  } = {},
): Promise<PhysicalStockCount[]> {
  const db = getCloudDataClient();
  let query = db
    .from("physical_stock_counts" as any)
    .select("data")
    .order("created_at", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(options.limit ?? PHYSICAL_STOCK_COUNT_READ_LIMIT);

  if (options.branchId) query = query.eq("branch_id", options.branchId);
  if (options.status) query = query.eq("status", options.status);

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown[])
    .map((row) => fromData(row as Record<string, unknown>))
    .filter((row): row is PhysicalStockCount => row !== null)
    .sort((a, b) => b.startedAt - a.startedAt);
}
