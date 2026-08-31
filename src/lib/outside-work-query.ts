import { getCloudDataClient } from "@/lib/providers/data-provider";
import type { OutsideWorkTransaction } from "@/lib/outside-work-store";
import type { OutsideWorkLabourCharge, OutsideWorkPayment } from "@/lib/outside-work-labour-store";

const OUTSIDE_WORK_READ_LIMIT = 1000;

function fromData<T>(row: Record<string, unknown> | null): T | null {
  if (!row) return null;
  const raw = row.data;
  if (raw && typeof raw === "object") return raw as T;
  return null;
}

function sortNewestFirst<T extends { ts: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.ts - a.ts);
}

export async function fetchOutsideWorkTransactions(
  options: {
    jewellerId?: string;
    orderId?: string;
    limit?: number;
  } = {},
): Promise<OutsideWorkTransaction[]> {
  const db = getCloudDataClient();
  let query = db
    .from("outside_work_transactions")
    .select("data")
    .order("updated_at", { ascending: false })
    .limit(options.limit ?? OUTSIDE_WORK_READ_LIMIT);

  if (options.jewellerId) query = query.eq("worker_id", options.jewellerId);
  if (options.orderId) query = query.eq("order_id", options.orderId);

  const { data, error } = await query;
  if (error) throw error;
  return sortNewestFirst(
    ((data ?? []) as unknown[])
      .map((row) => fromData<OutsideWorkTransaction>(row as Record<string, unknown>))
      .filter((row): row is OutsideWorkTransaction => row !== null),
  );
}

export async function fetchOutsideWorkLabourCharges(
  options: {
    jewellerId?: string;
    orderId?: string;
    limit?: number;
  } = {},
): Promise<OutsideWorkLabourCharge[]> {
  const db = getCloudDataClient();
  let query = db
    .from("outside_work_labour_charges")
    .select("data")
    .order("updated_at", { ascending: false })
    .limit(options.limit ?? OUTSIDE_WORK_READ_LIMIT);

  if (options.jewellerId) query = query.eq("worker_id", options.jewellerId);
  if (options.orderId) query = query.eq("order_id", options.orderId);

  const { data, error } = await query;
  if (error) throw error;
  return sortNewestFirst(
    ((data ?? []) as unknown[])
      .map((row) => fromData<OutsideWorkLabourCharge>(row as Record<string, unknown>))
      .filter((row): row is OutsideWorkLabourCharge => row !== null),
  );
}

export async function fetchOutsideWorkPayments(
  options: {
    jewellerId?: string;
    orderId?: string;
    limit?: number;
  } = {},
): Promise<OutsideWorkPayment[]> {
  const db = getCloudDataClient();
  let query = db
    .from("outside_work_payments")
    .select("data")
    .order("updated_at", { ascending: false })
    .limit(options.limit ?? OUTSIDE_WORK_READ_LIMIT);

  if (options.jewellerId) query = query.eq("worker_id", options.jewellerId);
  if (options.orderId) query = query.eq("order_id", options.orderId);

  const { data, error } = await query;
  if (error) throw error;
  return sortNewestFirst(
    ((data ?? []) as unknown[])
      .map((row) => fromData<OutsideWorkPayment>(row as Record<string, unknown>))
      .filter((row): row is OutsideWorkPayment => row !== null),
  );
}
