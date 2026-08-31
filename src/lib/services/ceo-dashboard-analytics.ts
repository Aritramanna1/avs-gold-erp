import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { resolveFirmIdForQuery, withFirmScope } from "@/lib/firm-scoped-query";
import {
  JOB_STATUS_FLOW,
  JOB_STATUS_LABELS,
  normalizeJobStatus,
  type JobStatus,
} from "@/lib/jobcards-store";

const DASHBOARD_ROW_LIMIT = 300;

function asNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function asPayload(row: { data?: unknown }): Record<string, unknown> {
  return row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : {};
}

export interface CeoGoldTrendPoint {
  date: string;
  grams: number;
}

export interface CeoManufacturingGoldSummary {
  totalOutstandingMg: number;
  issuedMg: number;
  returnedMg: number;
  wastageMg: number;
  capped: boolean;
}

export interface CeoProductionPipelinePoint {
  status: string;
  count: number;
}

export interface CeoWorkerPerformanceRow {
  karigarId: string;
  name: string;
  active: number;
  readyForBilling: number;
  pendingGoldMg: number;
}

export async function fetchCeoGoldTrend(days = 30): Promise<CeoGoldTrendPoint[]> {
  const safeDays = Math.max(2, Math.min(days, 90));
  const db = supabase as any;
  const { data, error } = await db.rpc("get_ceo_gold_trend", { p_days: safeDays });
  if (error) throw error;
  return (data ?? []).map((row: { day: string; fine_mg: number }) => ({
    date: new Date(row.day).toLocaleDateString("en-IN", { month: "numeric", day: "numeric" }),
    grams: Number((asNumber(row.fine_mg) / 1000).toFixed(3)),
  }));
}

export async function fetchCeoManufacturingGoldSummary(): Promise<CeoManufacturingGoldSummary> {
  const firmId = await resolveFirmIdForQuery();
  if (!firmId) {
    return { totalOutstandingMg: 0, issuedMg: 0, returnedMg: 0, wastageMg: 0, capped: false };
  }
  const { data, error } = await withFirmScope(
    (supabase as any)
      .from("manufacturing_bills")
      .select(
        "data,total_gold_issued_fine_mg,total_gold_returned_fine_mg,actual_wastage_fine_mg,closing_balance_mg",
      )
      .order("updated_at", { ascending: false })
      .limit(DASHBOARD_ROW_LIMIT),
    firmId,
  );
  if (error) throw error;

  let issuedMg = 0;
  let returnedMg = 0;
  let wastageMg = 0;
  let totalOutstandingMg = 0;

  for (const row of data ?? []) {
    const payload = asPayload(row);
    issuedMg += asNumber(row.total_gold_issued_fine_mg ?? payload.totalGoldIssuedFineMg);
    returnedMg += asNumber(row.total_gold_returned_fine_mg ?? payload.totalGoldReturnedFineMg);
    wastageMg += asNumber(row.actual_wastage_fine_mg ?? payload.actualWastageFineMg);
    totalOutstandingMg += Math.abs(asNumber(row.closing_balance_mg ?? payload.closingBalanceMg));
  }

  const workerOutstandingMg = await fetchWorkerOutstandingMg(firmId);

  return {
    totalOutstandingMg: totalOutstandingMg + workerOutstandingMg,
    issuedMg,
    returnedMg,
    wastageMg,
    capped: (data?.length ?? 0) >= DASHBOARD_ROW_LIMIT,
  };
}

export async function fetchCeoProductionPipeline(): Promise<CeoProductionPipelinePoint[]> {
  const firmId = await resolveFirmIdForQuery();
  if (!firmId) {
    return JOB_STATUS_FLOW.filter((status) => status !== "closed").map((status) => ({
      status: JOB_STATUS_LABELS[status],
      count: 0,
    }));
  }
  const statusCounts = new Map<JobStatus, number>();

  await Promise.all(
    JOB_STATUS_FLOW.map(async (status) => {
      const sourceStatuses = statusAliases(status);
      const counts = await Promise.all(
        sourceStatuses.map((s) => countJobCardsByStatus(s, firmId)),
      );
      statusCounts.set(
        status,
        counts.reduce((sum, count) => sum + count, 0),
      );
    }),
  );

  return JOB_STATUS_FLOW.filter((status) => status !== "closed").map((status) => ({
    status: JOB_STATUS_LABELS[status],
    count: statusCounts.get(status) ?? 0,
  }));
}

export async function fetchCeoWorkerPerformance(): Promise<CeoWorkerPerformanceRow[]> {
  const firmId = await resolveFirmIdForQuery();
  if (!firmId) return [];

  const [{ data: jobRows, error: jobError }, pendingGoldByWorker] = await Promise.all([
    withFirmScope(
      (supabase as any)
        .from("job_cards")
        .select("id,status,karigar_id,data")
        .order("updated_at", { ascending: false })
        .limit(DASHBOARD_ROW_LIMIT),
      firmId,
    ),
    fetchWorkerPendingGoldMap(firmId),
  ]);
  if (jobError) throw jobError;

  const byKarigar = new Map<string, { name: string; active: number; readyForBilling: number }>();
  for (const row of jobRows ?? []) {
    const payload = asPayload(row);
    const karigarId = String(row.karigar_id ?? payload.karigarId ?? "");
    if (!karigarId) continue;
    const status = normalizeJobStatus(
      String(row.status ?? payload.status ?? "awaiting_gold_issue") as JobStatus,
    );
    const entry = byKarigar.get(karigarId) ?? {
      name: String(payload.karigarName ?? karigarId),
      active: 0,
      readyForBilling: 0,
    };
    if (status === "ready_for_billing") entry.readyForBilling += 1;
    else if (status !== "closed") entry.active += 1;
    byKarigar.set(karigarId, entry);
  }

  return Array.from(byKarigar.entries())
    .map(([karigarId, row]) => ({
      karigarId,
      ...row,
      pendingGoldMg: pendingGoldByWorker.get(karigarId) ?? 0,
    }))
    .sort((a, b) => b.active - a.active || b.pendingGoldMg - a.pendingGoldMg)
    .slice(0, 8);
}

function statusAliases(status: JobStatus): string[] {
  if (status === "awaiting_gold_issue")
    return ["awaiting_gold_issue", "draft", "ready_for_gold_issue"];
  if (status === "work_received") return ["work_received", "qc_pending"];
  return [status];
}

async function countJobCardsByStatus(status: string, firmId: string): Promise<number> {
  const { count, error } = await withFirmScope(
    (supabase as any)
      .from("job_cards")
      .select("id", { count: "exact", head: true })
      .eq("status", status),
    firmId,
  );
  if (error) throw error;
  return count ?? 0;
}

async function fetchWorkerOutstandingMg(firmId: string): Promise<number> {
  const balances = await fetchWorkerPendingGoldMap(firmId);
  return Array.from(balances.values()).reduce((sum, mg) => sum + Math.abs(mg), 0);
}

async function fetchWorkerPendingGoldMap(firmId: string): Promise<Map<string, number>> {
  const { data, error } = await withFirmScope(
    (supabase as any)
      .from("worker_transactions")
      .select("data,kind")
      .in("kind", ["gold_book_given", "gold_book_return"])
      .order("created_at", { ascending: false })
      .limit(DASHBOARD_ROW_LIMIT),
    firmId,
  );
  if (error) throw error;

  const balances = new Map<string, number>();
  for (const row of data ?? []) {
    const payload = asPayload(row);
    const workerId = String(payload.workerId ?? "");
    if (!workerId) continue;
    const direction = row.kind === "gold_book_return" || payload.type === "return" ? -1 : 1;
    balances.set(workerId, (balances.get(workerId) ?? 0) + direction * asNumber(payload.fineMg));
  }
  return balances;
}
