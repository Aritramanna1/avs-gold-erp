import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { computeBalances, type BalanceSheet, type LedgerEntry } from "@/lib/ledger-store";

const REPORT_ROW_LIMIT = 1000;

type GoldLedgerRow = {
  data: unknown;
  ts: string | null;
};

export interface GoldPositionReportSummary {
  balance: BalanceSheet;
  entryCount: number;
  totalCount: number;
  capped: boolean;
}

function fromLedgerRow(row: GoldLedgerRow): LedgerEntry | null {
  const payload = row.data;
  if (!payload || typeof payload !== "object") return null;
  const entry = payload as Partial<LedgerEntry>;
  if (!entry.id || typeof entry.netFineMg !== "number") return null;
  return {
    ...entry,
    createdAt:
      typeof entry.createdAt === "number"
        ? entry.createdAt
        : row.ts
          ? new Date(row.ts).getTime()
          : Date.now(),
  } as LedgerEntry;
}

function isLedgerEntry(entry: LedgerEntry | null): entry is LedgerEntry {
  return entry !== null;
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
  let query = supabase
    .from("gold_ledger")
    .select("data,ts", { count: "exact" })
    .gte("ts", `${from}T00:00:00.000Z`)
    .lte("ts", `${to}T23:59:59.999Z`)
    .order("ts", { ascending: true })
    .range(0, REPORT_ROW_LIMIT - 1);

  if (branchId && branchId !== "all") {
    query = query.filter("data->>branchId", "eq", branchId);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const entries = ((data ?? []) as GoldLedgerRow[]).map(fromLedgerRow).filter(isLedgerEntry);
  return {
    balance: computeBalances(entries),
    entryCount: entries.length,
    totalCount: count ?? entries.length,
    capped: (count ?? 0) > REPORT_ROW_LIMIT,
  };
}
