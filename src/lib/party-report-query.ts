import { dataProvider as supabase } from "@/lib/providers/data-provider";
import type { Person } from "@/lib/people-store";
import type { WorkerGoldBookEntry } from "@/lib/worker-gold-book-store";
import type { GoldSettlementRecord } from "@/lib/supabase-services";

const PARTY_REPORT_LIMIT = 1000;

function readJsonRow<T>(row: unknown): T | null {
  if (!row || typeof row !== "object") return null;
  const raw = (row as { data?: unknown }).data;
  if (raw && typeof raw === "object") return raw as T;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  return row as T;
}

async function fetchPeopleByTypes(types: Person["type"][]): Promise<Person[]> {
  const { data, error } = await supabase
    .from("people")
    .select("data")
    .in("type", types)
    .order("full_name", { ascending: true })
    .limit(PARTY_REPORT_LIMIT);

  if (error) throw new Error(`Could not load parties: ${error.message}`);

  return ((data ?? []) as unknown[])
    .map((row) => readJsonRow<Person>(row))
    .filter((row): row is Person => !!row?.id);
}

async function fetchGoldSettlements(partyTypes: GoldSettlementRecord["party_type"][]) {
  const { data, error } = await supabase
    .from("gold_settlements")
    .select("data, settlement_date, party_type, party_id")
    .in("party_type", partyTypes)
    .order("settlement_date", { ascending: false })
    .limit(PARTY_REPORT_LIMIT);

  if (error) throw new Error(`Could not load gold settlements: ${error.message}`);

  return ((data ?? []) as unknown[])
    .map((row) => readJsonRow<GoldSettlementRecord>(row))
    .filter((row): row is GoldSettlementRecord => !!row?.id);
}

export interface DealerReportRow {
  id: string;
  name: string;
  transactionCount: number;
  goldBalanceMg: number;
  cashBalancePaise: number;
  lastSettlementDate: string | null;
}

export interface WorkerReportRow {
  id: string;
  name: string;
  pendingFineMg: number;
  pendingQty: number;
  lastSettlementDate: string | null;
}

export async function fetchDealerReportRows(): Promise<{
  rows: DealerReportRow[];
  capped: boolean;
}> {
  const [dealers, settlements] = await Promise.all([
    fetchPeopleByTypes(["vendor"]),
    fetchGoldSettlements(["vendor"]),
  ]);

  const rows = dealers.map((dealer) => {
    const dealerSettlements = settlements.filter(
      (settlement) => settlement.party_type === "vendor" && settlement.party_id === dealer.id,
    );
    const latest = dealerSettlements[0];
    return {
      id: dealer.id,
      name: dealer.fullName,
      transactionCount: dealerSettlements.length,
      goldBalanceMg: latest?.p_balance_gold_mg ?? 0,
      cashBalancePaise: latest?.p_balance_cash_paise ?? 0,
      lastSettlementDate: latest?.settlement_date ?? null,
    };
  });

  return {
    rows,
    capped: dealers.length >= PARTY_REPORT_LIMIT || settlements.length >= PARTY_REPORT_LIMIT,
  };
}

export async function fetchWorkerReportRows(): Promise<{
  rows: WorkerReportRow[];
  capped: boolean;
}> {
  const [workers, settlements, transactionRows] = await Promise.all([
    fetchPeopleByTypes(["karigar", "worker"]),
    fetchGoldSettlements(["worker"]),
    supabase
      .from("worker_transactions")
      .select("data, kind")
      .in("kind", ["gold_book_given", "gold_book_return"])
      .order("created_at", { ascending: false })
      .limit(PARTY_REPORT_LIMIT),
  ]);

  if (transactionRows.error) {
    throw new Error(`Could not load worker gold book entries: ${transactionRows.error.message}`);
  }

  const entries = ((transactionRows.data ?? []) as unknown[])
    .map((row) => readJsonRow<WorkerGoldBookEntry>(row))
    .filter((row): row is WorkerGoldBookEntry => !!row?.id);

  const rows = workers.map((worker) => {
    const workerEntries = entries.filter((entry) => entry.workerId === worker.id);
    const pendingFineMg = Math.max(
      0,
      workerEntries.reduce(
        (sum, entry) => sum + (entry.type === "given" ? entry.fineMg : -entry.fineMg),
        0,
      ),
    );
    const pendingQty = Math.max(
      0,
      workerEntries.reduce(
        (sum, entry) => sum + (entry.type === "given" ? entry.quantity : -entry.quantity),
        0,
      ),
    );
    const workerSettlements = settlements.filter(
      (settlement) => settlement.party_type === "worker" && settlement.party_id === worker.id,
    );

    return {
      id: worker.id,
      name: worker.fullName,
      pendingFineMg,
      pendingQty,
      lastSettlementDate: workerSettlements[0]?.settlement_date ?? null,
    };
  });

  return {
    rows,
    capped:
      workers.length >= PARTY_REPORT_LIMIT ||
      settlements.length >= PARTY_REPORT_LIMIT ||
      (transactionRows.data ?? []).length >= PARTY_REPORT_LIMIT,
  };
}
