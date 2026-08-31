/**
 * Server-backed Offline jewellery books — prefer RPCs over Zustand caches.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import type {
  AccountBalanceRow,
  FineRojmelRow,
  JamaNaveRow,
} from "@/lib/jewellery-books-reports";
import type { DateRange } from "@/lib/report-engine";

export type FineRojmelResult = {
  rows: FineRojmelRow[];
  openingMg: number;
  closingMg: number;
  total: number;
  capped: boolean;
};

export async function fetchFineRojmel(range: DateRange): Promise<FineRojmelResult> {
  const { data, error } = await supabase.rpc("get_fine_rojmel" as never, {
    p_from: range.from || null,
    p_to: range.to || null,
    p_limit: 2000,
  } as never);
  if (error) throw new Error(error.message);
  const payload = data as {
    rows?: FineRojmelRow[];
    openingMg?: number;
    closingMg?: number;
    total?: number;
    capped?: boolean;
  };
  return {
    rows: payload.rows ?? [],
    openingMg: Number(payload.openingMg ?? 0),
    closingMg: Number(payload.closingMg ?? 0),
    total: Number(payload.total ?? 0),
    capped: !!payload.capped,
  };
}

export async function fetchAccountBalances(
  variant: "1" | "2" = "1",
): Promise<AccountBalanceRow[]> {
  const { data, error } = await supabase.rpc("get_account_balances" as never, {
    p_variant: variant,
  } as never);
  if (error) throw new Error(error.message);
  const payload = data as { rows?: AccountBalanceRow[] };
  return payload.rows ?? [];
}

export async function fetchItemJamaNave(
  range: DateRange,
  mode: "item" | "account",
): Promise<JamaNaveRow[]> {
  const { data, error } = await supabase.rpc("get_item_jama_nave" as never, {
    p_mode: mode,
    p_from: range.from || null,
    p_to: range.to || null,
  } as never);
  if (error) throw new Error(error.message);
  const payload = data as { rows?: JamaNaveRow[] };
  return payload.rows ?? [];
}

export type DailyJewellerySummary = {
  from: string;
  to: string;
  goldInMg: number;
  goldOutMg: number;
  cashJamaPaise: number;
  cashNavePaise: number;
  invoiceCount: number;
  invoiceTotalPaise: number;
  purchaseCount: number;
  purchaseFineMg: number;
};

export async function fetchDailyJewellerySummary(
  range: DateRange,
): Promise<DailyJewellerySummary> {
  const { data, error } = await supabase.rpc("get_daily_jewellery_summary" as never, {
    p_from: range.from || null,
    p_to: range.to || null,
  } as never);
  if (error) throw new Error(error.message);
  const p = data as Record<string, unknown>;
  return {
    from: String(p.from ?? range.from ?? ""),
    to: String(p.to ?? range.to ?? ""),
    goldInMg: Number(p.goldInMg ?? 0),
    goldOutMg: Number(p.goldOutMg ?? 0),
    cashJamaPaise: Number(p.cashJamaPaise ?? 0),
    cashNavePaise: Number(p.cashNavePaise ?? 0),
    invoiceCount: Number(p.invoiceCount ?? 0),
    invoiceTotalPaise: Number(p.invoiceTotalPaise ?? 0),
    purchaseCount: Number(p.purchaseCount ?? 0),
    purchaseFineMg: Number(p.purchaseFineMg ?? 0),
  };
}
