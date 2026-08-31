import { dataProvider as supabase } from "@/lib/providers/data-provider";

const REPORT_ROW_LIMIT = 1000;

function asNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export interface GoldSummaryBillRow {
  id: string;
  billNo: string;
  karigarName: string;
  issuedMg: number;
  returnedMg: number;
  wastageMg: number;
  outstandingMg: number;
}

export interface GoldSummaryTotals {
  required: number;
  returned: number;
  wastage: number;
  outstanding: number;
}

export interface GoldSummaryWorkerRow {
  karigarId: string;
  karigarName: string;
  issuedMg: number;
  finishedMg: number;
  scrapMg: number;
  filingsMg: number;
  wastageMg: number;
  outstandingMg: number;
}

export interface GoldSummaryReportResult {
  bills: GoldSummaryBillRow[];
  custody: GoldSummaryWorkerRow[];
  totals: GoldSummaryTotals;
  capped: boolean;
}

export interface GoldOutstandingRow {
  source: "Manufacturing Bill" | "Worker Gold Book";
  name: string;
  reference: string;
  outstandingMg: number;
}

export async function fetchGoldSummaryReport(
  branchId?: string | null,
): Promise<GoldSummaryReportResult> {
  const [billResult, custody] = await Promise.all([
    fetchManufacturingBills(branchId),
    fetchWorkerCustodyRows(),
  ]);

  const totals = billResult.bills.reduce<GoldSummaryTotals>(
    (acc, row) => {
      acc.required += row.issuedMg;
      acc.returned += row.returnedMg;
      acc.wastage += row.wastageMg;
      acc.outstanding += row.outstandingMg;
      return acc;
    },
    { required: 0, returned: 0, wastage: 0, outstanding: 0 },
  );

  return {
    bills: billResult.bills,
    custody,
    totals,
    capped: billResult.capped,
  };
}

export async function fetchGoldOutstandingReport(branchId?: string | null): Promise<{
  rows: GoldOutstandingRow[];
  capped: boolean;
}> {
  const summary = await fetchGoldSummaryReport(branchId);
  const rows: GoldOutstandingRow[] = [
    ...summary.bills
      .filter((bill) => bill.outstandingMg !== 0)
      .map((bill) => ({
        source: "Manufacturing Bill" as const,
        name: bill.karigarName,
        reference: bill.billNo,
        outstandingMg: bill.outstandingMg,
      })),
    ...summary.custody
      .filter((worker) => worker.outstandingMg !== 0)
      .map((worker) => ({
        source: "Worker Gold Book" as const,
        name: worker.karigarName,
        reference: "Materials/findings ledger",
        outstandingMg: worker.outstandingMg,
      })),
  ];

  return {
    rows: rows.sort((a, b) => Math.abs(b.outstandingMg) - Math.abs(a.outstandingMg)),
    capped: summary.capped,
  };
}

async function fetchManufacturingBills(
  branchId?: string | null,
): Promise<{ bills: GoldSummaryBillRow[]; capped: boolean }> {
  let query = (supabase as any)
    .from("manufacturing_bills")
    .select(
      "id,bill_no,karigar_name,total_gold_issued_fine_mg,total_gold_returned_fine_mg,actual_wastage_fine_mg,closing_balance_mg,branch_id,data",
      { count: "exact" },
    )
    .order("updated_at", { ascending: false })
    .limit(REPORT_ROW_LIMIT);

  if (branchId) query = query.eq("branch_id", branchId);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    capped: (count ?? data?.length ?? 0) > REPORT_ROW_LIMIT,
    bills: (data ?? []).map((row: any) => {
      const payload = row.data && typeof row.data === "object" ? row.data : {};
      return {
        id: String(row.id),
        billNo: String(row.bill_no ?? payload.billNo ?? row.id),
        karigarName: String(row.karigar_name ?? payload.karigarName ?? "-"),
        issuedMg: asNumber(row.total_gold_issued_fine_mg ?? payload.totalGoldIssuedFineMg),
        returnedMg: asNumber(row.total_gold_returned_fine_mg ?? payload.totalGoldReturnedFineMg),
        wastageMg: asNumber(row.actual_wastage_fine_mg ?? payload.actualWastageFineMg),
        outstandingMg: asNumber(row.closing_balance_mg ?? payload.closingBalanceMg),
      };
    }),
  };
}

async function fetchWorkerCustodyRows(): Promise<GoldSummaryWorkerRow[]> {
  const { data, error } = await (supabase as any)
    .from("worker_transactions")
    .select("data,kind")
    .in("kind", ["gold_book_given", "gold_book_return"])
    .order("created_at", { ascending: false })
    .limit(REPORT_ROW_LIMIT);
  if (error) throw error;

  const byWorker = new Map<string, GoldSummaryWorkerRow>();
  for (const row of data ?? []) {
    const payload = row.data && typeof row.data === "object" ? row.data : {};
    const karigarId = String(payload.workerId ?? "");
    if (!karigarId) continue;
    const entry = byWorker.get(karigarId) ?? {
      karigarId,
      karigarName: String(payload.workerName ?? karigarId),
      issuedMg: 0,
      finishedMg: 0,
      scrapMg: 0,
      filingsMg: 0,
      wastageMg: 0,
      outstandingMg: 0,
    };
    const fineMg = asNumber(payload.fineMg);
    if (row.kind === "gold_book_return" || payload.type === "return") {
      entry.outstandingMg -= fineMg;
      const particulars = String(payload.particulars ?? "");
      if (particulars.startsWith("Finished:")) entry.finishedMg += fineMg;
      else if (particulars === "Scrap Returned") entry.scrapMg += fineMg;
      else if (particulars === "Filings Returned") entry.filingsMg += fineMg;
      else if (particulars === "Melt Loss / Wastage" || particulars === "Dust/Sweepings Returned") {
        entry.wastageMg += fineMg;
      }
    } else {
      entry.issuedMg += fineMg;
      entry.outstandingMg += fineMg;
    }
    byWorker.set(karigarId, entry);
  }

  return Array.from(byWorker.values()).sort(
    (a, b) => Math.abs(b.outstandingMg) - Math.abs(a.outstandingMg),
  );
}
