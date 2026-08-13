import { getCloudDataClient } from "@/lib/providers/data-provider";
import type { StoneRecord, StoneType as StockStoneType } from "@/lib/stone-store";
import type { StoneDetail, StoneType as StoneDetailType } from "@/lib/stone-tracking-store";

const STONE_READ_LIMIT = 500;

function fromData<T>(row: Record<string, unknown> | null): T | null {
  if (!row) return null;
  const raw = row.data;
  if (raw && typeof raw === "object") return raw as T;
  return null;
}

export async function fetchStockStones(
  options: {
    branchId?: string;
    itemId?: string;
    stoneType?: StockStoneType;
    certificateNumber?: string;
    limit?: number;
  } = {},
): Promise<StoneRecord[]> {
  const db = getCloudDataClient();
  let query = db
    .from("stock_stones" as any)
    .select("data")
    .order("created_at", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(options.limit ?? STONE_READ_LIMIT);

  if (options.branchId) query = query.eq("branch_id", options.branchId);
  if (options.itemId) query = query.eq("item_id", options.itemId);
  if (options.stoneType) query = query.eq("stone_type", options.stoneType);
  if (options.certificateNumber) query = query.eq("certificate_number", options.certificateNumber);

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown[])
    .map((row) => fromData<StoneRecord>(row as Record<string, unknown>))
    .filter((row): row is StoneRecord => row !== null)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function fetchStoneDetails(
  options: {
    stockItemId?: string;
    stoneType?: StoneDetailType;
    certificateNumber?: string;
    limit?: number;
  } = {},
): Promise<StoneDetail[]> {
  const db = getCloudDataClient();
  const { data, error } = await db
    .from("stone_details")
    .select("data")
    .order("updated_at", { ascending: false })
    .limit(options.limit ?? STONE_READ_LIMIT);

  if (error) throw error;
  return ((data ?? []) as unknown[])
    .map((row) => fromData<StoneDetail>(row as Record<string, unknown>))
    .filter((row): row is StoneDetail => row !== null)
    .filter((row) => !options.stockItemId || row.stockItemId === options.stockItemId)
    .filter((row) => !options.stoneType || row.stoneType === options.stoneType)
    .filter(
      (row) => !options.certificateNumber || row.certificateNumber === options.certificateNumber,
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
