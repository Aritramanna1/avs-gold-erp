import { getCloudDataClient } from "@/lib/providers/data-provider";
import type { CustomerGoldDeposit } from "@/lib/customer-gold-deposit-store";
import type { MaterialMovement } from "@/lib/material-vault-store";
import type { ConversionRecord } from "@/lib/metal-conversion-store";
import type { PolishingTransaction, PolishingTransactionType } from "@/lib/polishing-store";
import type { Settlement } from "@/lib/settlement-store";
import type { WorkerReturn } from "@/lib/worker-return-store";
import type { WorkshopProcessTransaction } from "@/lib/workshop-process-store";
import type { WorkshopProcessType } from "@/lib/settings-store";

const CUSTODY_FLOW_READ_LIMIT = 500;

function fromData<T>(row: Record<string, unknown> | null): T | null {
  if (!row) return null;
  const raw = row.data;
  if (raw && typeof raw === "object") return raw as T;
  return null;
}

async function fetchDataRows<T>(
  table: string,
  limit: number,
  orderColumn: "created_at" | "updated_at" = "updated_at",
): Promise<T[]> {
  const db = getCloudDataClient();
  const { data, error } = await db
    .from(table as any)
    .select("data")
    .order(orderColumn, { ascending: false })
    .limit(limit);

  if (error) throw error;
  return ((data ?? []) as unknown[])
    .map((row) => fromData<T>(row as Record<string, unknown>))
    .filter((row): row is T => row !== null);
}

export async function fetchCustomerGoldDeposits(
  options: {
    customerId?: string;
    metal?: string;
    limit?: number;
  } = {},
): Promise<CustomerGoldDeposit[]> {
  const rows = await fetchDataRows<CustomerGoldDeposit>(
    "customer_gold_deposits",
    options.limit ?? CUSTODY_FLOW_READ_LIMIT,
  );
  return rows
    .filter((row) => !options.customerId || row.customerId === options.customerId)
    .filter((row) => !options.metal || (row.metal ?? "Gold") === options.metal)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function fetchMaterialVaultMovements(
  options: {
    branchId?: string;
    category?: string;
    type?: MaterialMovement["type"];
    limit?: number;
  } = {},
): Promise<MaterialMovement[]> {
  const rows = await fetchDataRows<MaterialMovement>(
    "material_vault_movements",
    options.limit ?? CUSTODY_FLOW_READ_LIMIT,
  );
  return rows
    .filter((row) => !options.branchId || row.branchId === options.branchId)
    .filter((row) => !options.category || row.category === options.category)
    .filter((row) => !options.type || row.type === options.type)
    .sort((a, b) => b.ts - a.ts);
}

export async function fetchMetalConversions(
  options: {
    sourcePurity?: number;
    destPurity?: number;
    limit?: number;
  } = {},
): Promise<ConversionRecord[]> {
  const rows = await fetchDataRows<ConversionRecord>(
    "metal_conversions",
    options.limit ?? CUSTODY_FLOW_READ_LIMIT,
  );
  return rows
    .filter((row) => !options.sourcePurity || row.sourcePurity === options.sourcePurity)
    .filter((row) => !options.destPurity || row.destPurity === options.destPurity)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function fetchPolishingTransactions(
  options: {
    orderId?: string;
    polisherId?: string;
    type?: PolishingTransactionType;
    limit?: number;
  } = {},
): Promise<PolishingTransaction[]> {
  const rows = await fetchDataRows<PolishingTransaction>(
    "polishing_transactions",
    options.limit ?? CUSTODY_FLOW_READ_LIMIT,
  );
  return rows
    .filter((row) => !options.orderId || row.orderId === options.orderId)
    .filter((row) => !options.polisherId || row.polisherId === options.polisherId)
    .filter((row) => !options.type || row.type === options.type)
    .sort((a, b) => b.ts - a.ts);
}

export async function fetchCustomerSettlements(
  options: {
    branchId?: string;
    customerId?: string;
    orderId?: string;
    limit?: number;
  } = {},
): Promise<Settlement[]> {
  const db = getCloudDataClient();
  let query = db
    .from("customer_settlements")
    .select("data")
    .order("updated_at", { ascending: false })
    .limit(options.limit ?? CUSTODY_FLOW_READ_LIMIT);

  if (options.branchId) query = query.eq("branch_id", options.branchId);
  if (options.orderId) query = query.eq("order_id", options.orderId);

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown[])
    .map((row) => fromData<Settlement>(row as Record<string, unknown>))
    .filter((row): row is Settlement => row !== null)
    .filter((row) => !options.customerId || row.customerId === options.customerId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function fetchWorkerReturns(
  options: {
    branchId?: string;
    orderId?: string;
    workerId?: string;
    limit?: number;
  } = {},
): Promise<WorkerReturn[]> {
  const db = getCloudDataClient();
  let query = db
    .from("worker_returns")
    .select("data")
    .order("updated_at", { ascending: false })
    .limit(options.limit ?? CUSTODY_FLOW_READ_LIMIT);

  if (options.branchId) query = query.eq("branch_id", options.branchId);
  if (options.orderId) query = query.eq("order_id", options.orderId);
  if (options.workerId) query = query.eq("worker_id", options.workerId);

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown[])
    .map((row) => fromData<WorkerReturn>(row as Record<string, unknown>))
    .filter((row): row is WorkerReturn => row !== null)
    .sort((a, b) => b.ts - a.ts);
}

export async function fetchWorkshopProcessTransactions(
  options: {
    processType?: WorkshopProcessType;
    karigarId?: string;
    jobCardId?: string;
    limit?: number;
  } = {},
): Promise<WorkshopProcessTransaction[]> {
  const rows = await fetchDataRows<WorkshopProcessTransaction>(
    "workshop_process_transactions",
    options.limit ?? CUSTODY_FLOW_READ_LIMIT,
  );
  return rows
    .filter((row) => !options.processType || row.processType === options.processType)
    .filter((row) => !options.karigarId || row.karigarId === options.karigarId)
    .filter((row) => !options.jobCardId || row.jobCardId === options.jobCardId)
    .sort((a, b) => b.createdAt - a.createdAt);
}
