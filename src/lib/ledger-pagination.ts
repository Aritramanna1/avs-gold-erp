/**
 * Server-backed paginated ledger queries — prefer RPC over full client hydrate.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { beginEgressOperation } from "@/lib/monitoring/supabase-egress-monitor";
import type { UniversalMoneyEntry } from "@/lib/money-voucher";
import type { LedgerEntry } from "@/lib/ledger-store";

export type PaginatedResult<T> = {
  rows: T[];
  total: number;
  limit: number;
  offset: number;
};

type CashPageRow = {
  id: string;
  voucher_number: string;
  voucher_date: string;
  counterparty_id: string | null;
  counterparty_name: string | null;
  cash_debit_paise: number;
  cash_credit_paise: number;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
};

export async function fetchCompanyCashLedgerPage(params: {
  accountId?: string;
  partyId?: string;
  source?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): Promise<PaginatedResult<UniversalMoneyEntry>> {
  try {
    const { data, error } = await supabase.rpc(
      "get_company_cash_ledger_page" as never,
      {
        p_account_id: params.accountId ?? null,
        p_party_id: params.partyId ?? null,
        p_source: params.source ?? null,
        p_from: params.from ?? null,
        p_to: params.to ?? null,
        p_limit: params.limit ?? 100,
        p_offset: params.offset ?? 0,
      } as never,
    );
    if (error) {
      return { rows: [], total: 0, limit: params.limit ?? 100, offset: params.offset ?? 0 };
    }
    const payload = data as {
      rows?: CashPageRow[];
      total?: number;
      limit?: number;
      offset?: number;
    };
    const rows = (payload.rows ?? []).map(
      (row): UniversalMoneyEntry => ({
        id: row.id,
        voucherNumber: row.voucher_number,
        voucherDate: row.voucher_date,
        counterpartyId: row.counterparty_id,
        counterpartyName: row.counterparty_name,
        cashDebitPaise: Number(row.cash_debit_paise) || 0,
        cashCreditPaise: Number(row.cash_credit_paise) || 0,
        transactionCode: null,
        metadata: {
          ...(row.metadata ?? {}),
          postedBy:
            (row.metadata?.postedBy as string | undefined) ??
            (row.metadata?.posted_by as string | undefined) ??
            row.created_by ??
            "",
        },
        createdAt: row.created_at,
        reversalRefId: null,
      }),
    );
    return {
      rows,
      total: Number(payload.total ?? rows.length),
      limit: Number(payload.limit ?? params.limit ?? 100),
      offset: Number(payload.offset ?? params.offset ?? 0),
    };
  } catch {
    return { rows: [], total: 0, limit: params.limit ?? 100, offset: params.offset ?? 0 };
  }
}

type GoldPageRow = {
  id: string;
  ts: string;
  net_fine_mg: number;
  bucket_deltas: Record<string, number> | null;
  data: LedgerEntry | null;
};

export async function fetchGoldLedgerPage(params: {
  bucket?: string;
  purity?: string;
  type?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
  /** 'desc' for recent-tail cache; default 'asc' for report pagination. */
  order?: "asc" | "desc";
}): Promise<PaginatedResult<LedgerEntry>> {
  const op = beginEgressOperation("gold_ledger_page");
  try {
    const { data, error } = await supabase.rpc(
      "get_gold_ledger_page" as never,
      {
        p_bucket: params.bucket ?? null,
        p_purity: params.purity ?? null,
        p_type: params.type ?? null,
        p_from: params.from ? `${params.from}T00:00:00.000Z` : null,
        p_to: params.to ? `${params.to}T23:59:59.999Z` : null,
        p_limit: params.limit ?? 100,
        p_offset: params.offset ?? 0,
        p_order: params.order ?? "asc",
      } as never,
    );
    if (error) {
      op.finish(false, error.message);
      return {
        rows: [],
        total: 0,
        limit: params.limit ?? 100,
        offset: params.offset ?? 0,
      };
    }
    const payload = data as {
      rows?: GoldPageRow[];
      total?: number;
      limit?: number;
      offset?: number;
    };
    const rows = (payload.rows ?? [])
      .map((row) => {
        const entry = row.data;
        if (!entry?.id) return null;
        return {
          ...entry,
          createdAt:
            typeof entry.createdAt === "number"
              ? entry.createdAt
              : new Date(row.ts).getTime(),
        } as LedgerEntry;
      })
      .filter((e): e is LedgerEntry => e !== null);
    op.finish(true);
    return {
      rows,
      total: Number(payload.total ?? rows.length),
      limit: Number(payload.limit ?? params.limit ?? 100),
      offset: Number(payload.offset ?? params.offset ?? 0),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "fetch failed";
    op.finish(false, msg);
    return {
      rows: [],
      total: 0,
      limit: params.limit ?? 100,
      offset: params.offset ?? 0,
    };
  }
}

/** Paginate gold_ledger rows in a date range without PostgREST COUNT. */
export async function fetchGoldLedgerInRange(params: {
  from: string;
  to: string;
  type?: string;
  maxRows?: number;
  pageSize?: number;
}): Promise<{ rows: LedgerEntry[]; capped: boolean }> {
  const maxRows = params.maxRows ?? 500;
  const pageSize = Math.min(100, params.pageSize ?? 100);
  const rows: LedgerEntry[] = [];
  let offset = 0;

  while (rows.length < maxRows) {
    const page = await fetchGoldLedgerPage({
      from: params.from,
      to: params.to,
      type: params.type,
      limit: pageSize,
      offset,
      order: "asc",
    });
    rows.push(...page.rows);
    if (page.rows.length < pageSize) break;
    offset += pageSize;
  }

  return { rows: rows.slice(0, maxRows), capped: rows.length >= maxRows };
}

export async function fetchFirmLedgerBalancesRpc(): Promise<{
  buckets: Record<string, number>;
  ledgerTotal: number;
  entryCount: number;
  totalUnderManagement: number;
  discrepancyMg: number;
  balanced: boolean;
} | null> {
  const { data, error } = await supabase.rpc("get_firm_ledger_balances" as never, {
    p_branch_id: null,
    p_metal_code: "gold",
  } as never);
  if (error || !data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  const buckets = (row.buckets ?? {}) as Record<string, number>;
  return {
    buckets,
    ledgerTotal: Number(row.ledgerTotal ?? 0),
    entryCount: Number(row.entryCount ?? 0),
    totalUnderManagement: Number(row.totalUnderManagement ?? 0),
    discrepancyMg: Number(row.discrepancyMg ?? 0),
    balanced: !!row.balanced,
  };
}

export async function fetchPartyLedgerSummary(): Promise<
  Array<{ partyId: string; customerFineMg: number; entryCount: number }>
> {
  const { data, error } = await supabase.rpc("get_party_ledger_summary" as never);
  if (error) throw new Error(error.message);
  const payload = data as {
    parties?: Array<{
      party_id: string;
      customer_fine_mg: number;
      entry_count: number;
    }>;
  };
  return (payload.parties ?? []).map((p) => ({
    partyId: p.party_id,
    customerFineMg: Number(p.customer_fine_mg) || 0,
    entryCount: Number(p.entry_count) || 0,
  }));
}
