/**
 * Gold Reconciliation Engine (Priority 6).
 *
 * For every finalised Manufacturing Bill, gold must balance:
 *
 *   issuedFineMg (vault issue + karigar top-ups)
 *     === accountedFineMg (finished jewellery + scrap/lagad/filings returned + recorded wastage)
 *
 * Any bill where these don't match within `toleranceMg` is an exception —
 * per the explicit requirement that even a 0.001g (1mg... actually 0.001g
 * = 1mg is NOT the same; 0.001 gram = 1 milligram, so toleranceMg defaults
 * to 1) discrepancy must be explainable. Every exception gets its own
 * immutable audit log entry (Plan 1 Step 8's audit-log.ts) — a reconciliation
 * exception IS a security-relevant event (unaccounted gold), not just a
 * report line.
 *
 * Scope note: this reconciles at the Manufacturing Bill level (issued vs.
 * finished+scrap+wastage), which is where wastage/recovery are actually
 * recorded in this codebase today. A full opening/closing-balance vault
 * reconciliation across ALL gold movements (stock, worker gold book,
 * customer old-gold, supplier gold) spanning a date range is a larger
 * aggregation this pass didn't attempt — documented as a follow-up, not
 * silently implied.
 */
import { useMfgBills, type ManufacturingBill } from "@/lib/manufacturing-bill-store";
import { append as appendAuditEntry } from "@/lib/security/audit-log";
import { getCloudDataClient } from "@/lib/providers/data-provider";

export interface BillReconciliation {
  billId: string;
  billNo: string;
  branchId: string;
  issuedFineMg: number;
  accountedFineMg: number;
  discrepancyMg: number;
  isException: boolean;
}

export interface ReconciliationReport {
  id: string;
  generatedAt: string;
  branchId: string | null;
  totalChecked: number;
  exceptionCount: number;
  exceptions: BillReconciliation[];
  all: BillReconciliation[];
}

const DEFAULT_TOLERANCE_MG = 1; // 0.001 gram

export function reconcileBill(
  bill: ManufacturingBill,
  toleranceMg = DEFAULT_TOLERANCE_MG,
): BillReconciliation {
  const pFine = bill.pEntries.reduce((s, e) => s + e.fineMg, 0);
  const mpFine = bill.mpEntries.reduce((s, e) => s + e.fineMg, 0);

  const issuedFineMg = bill.goldIssuedFineMg + pFine;
  const accountedFineMg = bill.finishedFineMg + mpFine + (bill.actualWastageFineMg ?? 0);
  const discrepancyMg = issuedFineMg - accountedFineMg;

  return {
    billId: bill.id,
    billNo: bill.billNo,
    branchId: bill.branchId,
    issuedFineMg,
    accountedFineMg,
    discrepancyMg,
    isException: Math.abs(discrepancyMg) > toleranceMg,
  };
}

function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Reconciles every FINALISED (or later-status) bill — a draft bill's gold
 * flow isn't complete yet, so it's excluded rather than flagged as a false
 * exception. Persists the full report and appends one audit log entry per
 * exception found, then returns the report.
 */
export async function runGoldReconciliation(
  branchId?: string,
  toleranceMg = DEFAULT_TOLERANCE_MG,
): Promise<ReconciliationReport> {
  const bills = useMfgBills
    .getState()
    .bills.filter((b) => b.status !== "draft" && (!branchId || b.branchId === branchId));

  const all = bills.map((b) => reconcileBill(b, toleranceMg));
  const exceptions = all.filter((r) => r.isException);

  const report: ReconciliationReport = {
    id: makeId("recon"),
    generatedAt: new Date().toISOString(),
    branchId: branchId ?? null,
    totalChecked: all.length,
    exceptionCount: exceptions.length,
    exceptions,
    all,
  };

  const { error } = await getCloudDataClient().from("gold_reconciliation_reports" as any).insert({
    id: report.id,
    generated_at: report.generatedAt,
    branch_id: branchId ?? null,
    total_checked: report.totalChecked,
    exception_count: report.exceptionCount,
    report_json: report,
  });
  if (error) throw error;

  for (const exception of exceptions) {
    await appendAuditEntry({
      actorId: null,
      actorEmail: null,
      action: "gold_reconciliation.exception",
      entityType: "manufacturing_bills",
      entityId: exception.billId,
      before: null,
      after: exception,
      deviceId: null,
    });
  }

  return report;
}

export async function getReconciliationHistory(limit = 50): Promise<ReconciliationReport[]> {
  const { data, error } = await getCloudDataClient()
    .from("gold_reconciliation_reports" as any)
    .select("report_json")
    .order("generated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as Array<{ report_json: ReconciliationReport }>).map(
    (row) => row.report_json,
  );
}
