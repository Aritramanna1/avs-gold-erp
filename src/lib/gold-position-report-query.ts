import { computeBalances, type LedgerEntry } from "@/lib/ledger-store";
import { fetchGoldLedgerInRange } from "@/lib/ledger-pagination";
import { resolveFirmIdForQuery } from "@/lib/firm-scoped-query";

const REPORT_ROW_LIMIT = 500;

export interface GoldPositionReportSummary {
  balance: ReturnType<typeof computeBalances>;
  entryCount: number;
  totalCount: number;
  capped: boolean;
}

function filterBranch(entries: LedgerEntry[], branchId?: string | null): LedgerEntry[] {
  if (!branchId || branchId === "all") return entries;
  return entries.filter((e) => (e as { branchId?: string }).branchId === branchId);
}

export async function fetchGoldPositionReport({
  from,
  to,
  branchId,
}: {
  from: string;
  to: string;
  branchId?: string | null;
}): Promise<GoldPositionReportSummary> {
  const firmId = await resolveFirmIdForQuery();
  if (!firmId) {
    return {
      balance: computeBalances([]),
      entryCount: 0,
      totalCount: 0,
      capped: false,
    };
  }

  const { rows, capped } = await fetchGoldLedgerInRange({
    from,
    to,
    maxRows: REPORT_ROW_LIMIT,
  });
  const entries = filterBranch(rows, branchId);

  return {
    balance: computeBalances(entries),
    entryCount: entries.length,
    totalCount: entries.length,
    capped,
  };
}
