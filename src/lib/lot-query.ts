import { getCloudDataClient } from "@/lib/providers/data-provider";
import type { StockLot, LotStatus as StockLotStatus } from "@/lib/lot-store";
import type { LotBatch, LotStatus as LotBatchStatus } from "@/lib/lot-batch-store";

const LOT_READ_LIMIT = 500;

function fromData<T>(row: Record<string, unknown> | null): T | null {
  if (!row) return null;
  const raw = row.data;
  if (raw && typeof raw === "object") return raw as T;
  return null;
}

export async function fetchStockLots(
  options: {
    branchId?: string;
    status?: StockLotStatus;
    limit?: number;
  } = {},
): Promise<StockLot[]> {
  const db = getCloudDataClient();
  let query = db
    .from("stock_lots" as any)
    .select("data")
    .order("created_at", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(options.limit ?? LOT_READ_LIMIT);

  if (options.branchId) query = query.eq("branch_id", options.branchId);
  if (options.status) query = query.eq("status", options.status);

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown[])
    .map((row) => fromData<StockLot>(row as Record<string, unknown>))
    .filter((row): row is StockLot => row !== null)
    .sort((a, b) => b.receivedAt - a.receivedAt);
}

export async function fetchLotBatches(
  options: {
    status?: LotBatchStatus;
    limit?: number;
  } = {},
): Promise<LotBatch[]> {
  const db = getCloudDataClient();
  const { data, error } = await db
    .from("lot_batches")
    .select("data")
    .order("updated_at", { ascending: false })
    .limit(options.limit ?? LOT_READ_LIMIT);

  if (error) throw error;
  return ((data ?? []) as unknown[])
    .map((row) => fromData<LotBatch>(row as Record<string, unknown>))
    .filter((row): row is LotBatch => row !== null)
    .filter((row) => !options.status || row.status === options.status)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
