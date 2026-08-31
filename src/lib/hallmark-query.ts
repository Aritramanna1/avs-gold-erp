import { getCloudDataClient } from "@/lib/providers/data-provider";
import type { HallmarkBatch, HallmarkBatchStatus } from "@/lib/hallmark-store";

const HALLMARK_BATCH_READ_LIMIT = 500;

function fromData(row: Record<string, unknown> | null): HallmarkBatch | null {
  if (!row) return null;
  const raw = row.data;
  if (raw && typeof raw === "object") return raw as HallmarkBatch;
  return null;
}

export async function fetchHallmarkBatches(
  options: {
    branchId?: string;
    status?: HallmarkBatchStatus;
    limit?: number;
  } = {},
): Promise<HallmarkBatch[]> {
  const db = getCloudDataClient();
  let query = db
    .from("hallmark_batches" as any)
    .select("data")
    .order("created_at", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(options.limit ?? HALLMARK_BATCH_READ_LIMIT);

  if (options.branchId) query = query.eq("branch_id", options.branchId);
  if (options.status) query = query.eq("status", options.status);

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown[])
    .map((row) => fromData(row as Record<string, unknown>))
    .filter((row): row is HallmarkBatch => row !== null)
    .sort((a, b) => b.sentAt - a.sentAt);
}
