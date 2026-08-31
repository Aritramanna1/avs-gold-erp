/**
 * Exception Reporting — a single read-only aggregation across existing
 * stores that surfaces anything needing manager attention: overdue orders/
 * repairs/job-cards, unresolved gold-reconciliation discrepancies, and
 * physical-stock-count shortages. Pure functions over already-loaded store
 * state — no new tables, no writes, so this carries zero risk to the
 * financial/gold data it reports on.
 */
import { useOrders, ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/orders-store";
import { useRepairs, REPAIR_STATUS_LABELS } from "@/lib/repair-store";
import { useJobCards, JOB_STATUS_LABELS } from "@/lib/jobcards-store";
import { getReconciliationHistory } from "@/lib/reconciliation/gold-reconciliation";
import { usePhysicalStockCounts } from "@/lib/physical-stock-verification-store";

export type ExceptionSeverity = "high" | "medium" | "low";
export type ExceptionCategory =
  "overdue_order" | "overdue_repair" | "overdue_job_card" | "gold_discrepancy" | "stock_shortage";

export interface ExceptionItem {
  id: string;
  category: ExceptionCategory;
  severity: ExceptionSeverity;
  title: string;
  detail: string;
  linkedId: string;
  branchId?: string | null;
  daysOverdue?: number;
}

const CLOSED_ORDER_STATUSES: OrderStatus[] = ["delivered", "cancelled", "billed"];

function daysSince(dateStr: string): number {
  const then = new Date(dateStr).getTime();
  if (!Number.isFinite(then)) return 0;
  return Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
}

function overdueSeverity(days: number): ExceptionSeverity {
  if (days > 14) return "high";
  if (days > 3) return "medium";
  return "low";
}

export function findOverdueOrders(): ExceptionItem[] {
  const orders = useOrders.getState().orders;
  return orders
    .filter(
      (o) =>
        o.expectedDelivery &&
        !CLOSED_ORDER_STATUSES.includes(o.status) &&
        daysSince(o.expectedDelivery) > 0,
    )
    .map((o) => {
      const days = daysSince(o.expectedDelivery!);
      return {
        id: `order_${o.id}`,
        category: "overdue_order" as const,
        severity: overdueSeverity(days),
        title: `Order ${o.orderNo} overdue`,
        detail: `Expected ${o.expectedDelivery}, still "${ORDER_STATUS_LABELS[o.status]}" — ${days} day(s) late.`,
        linkedId: o.id,
        daysOverdue: days,
      };
    });
}

export function findOverdueRepairs(): ExceptionItem[] {
  const repairs = useRepairs.getState().repairs;
  return repairs
    .filter(
      (r) =>
        r.expectedDelivery &&
        r.status !== "delivered" &&
        r.status !== "cancelled" &&
        daysSince(r.expectedDelivery) > 0,
    )
    .map((r) => {
      const days = daysSince(r.expectedDelivery!);
      return {
        id: `repair_${r.id}`,
        category: "overdue_repair" as const,
        severity: overdueSeverity(days),
        title: `Repair ${r.repairNo} overdue`,
        detail: `Expected ${r.expectedDelivery}, still "${REPAIR_STATUS_LABELS[r.status]}" — ${days} day(s) late.`,
        linkedId: r.id,
        daysOverdue: days,
      };
    });
}

export function findOverdueJobCards(): ExceptionItem[] {
  const jobs = useJobCards.getState().jobs;
  return jobs
    .filter((j) => j.expectedDelivery && j.status !== "closed" && daysSince(j.expectedDelivery) > 0)
    .map((j) => {
      const days = daysSince(j.expectedDelivery!);
      return {
        id: `job_${j.id}`,
        category: "overdue_job_card" as const,
        severity: overdueSeverity(days),
        title: `Job Card overdue`,
        detail: `Expected ${j.expectedDelivery}, still "${JOB_STATUS_LABELS[j.status]}" — ${days} day(s) late.`,
        linkedId: j.id,
        daysOverdue: days,
      };
    });
}

export async function findGoldDiscrepancies(): Promise<ExceptionItem[]> {
  const history = await getReconciliationHistory(5);
  const latest = history[0];
  if (!latest) return [];
  return latest.exceptions.map((e) => ({
    id: `recon_${e.billId}`,
    category: "gold_discrepancy" as const,
    severity: Math.abs(e.discrepancyMg) > 100 ? "high" : "medium",
    title: `Bill ${e.billNo} gold discrepancy`,
    detail: `Issued ${e.issuedFineMg}mg vs accounted ${e.accountedFineMg}mg — discrepancy ${e.discrepancyMg}mg.`,
    linkedId: e.billId,
    branchId: e.branchId,
  }));
}

export function findStockShortages(): ExceptionItem[] {
  return usePhysicalStockCounts
    .getState()
    .counts.filter((c) => c.status === "completed" && (c.shortFineMg ?? 0) > 0)
    .map((c) => ({
      id: `stockcount_${c.id}`,
      category: "stock_shortage" as const,
      severity: (c.shortFineMg ?? 0) > 500 ? "high" : "medium",
      title: `Stock count shortage — ${c.branchId}`,
      detail: `Physical count on ${new Date(c.startedAt).toLocaleDateString()} found ${c.shortFineMg}mg fine gold short.`,
      linkedId: c.id,
      branchId: c.branchId,
    }));
}

/**
 * Aggregates every exception category. Callers must ensure the underlying
 * stores (orders, repairs, job cards, physical stock counts) are already
 * loaded — this does not trigger fetches itself, matching how existing
 * report pages read live store state.
 */
export async function collectExceptions(): Promise<ExceptionItem[]> {
  const [orders, repairs, jobs, discrepancies, shortages] = await Promise.all([
    Promise.resolve(findOverdueOrders()),
    Promise.resolve(findOverdueRepairs()),
    Promise.resolve(findOverdueJobCards()),
    findGoldDiscrepancies(),
    Promise.resolve(findStockShortages()),
  ]);
  const severityRank: Record<ExceptionSeverity, number> = { high: 0, medium: 1, low: 2 };
  return [...orders, ...repairs, ...jobs, ...discrepancies, ...shortages].sort(
    (a, b) => severityRank[a.severity] - severityRank[b.severity],
  );
}
