/**
 * Server-backed Offline Item Stock / Barcode pending / Dhadi books.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import type { DateRange } from "@/lib/report-engine";

export type ItemStockRow = {
  item_code: string;
  item_name: string;
  category: string;
  pcs: number;
  gross_mg: number;
  net_mg: number;
  fine_mg: number;
  cost_paise: number;
};

export async function fetchItemStockBook(
  status: "on_hand" | "all" | string = "on_hand",
): Promise<ItemStockRow[]> {
  const { data, error } = await supabase.rpc("get_item_stock_book" as never, {
    p_status: status,
  } as never);
  if (error) throw new Error(error.message);
  const payload = data as { rows?: ItemStockRow[] };
  return (payload.rows ?? []).map((r) => ({
    ...r,
    pcs: Number(r.pcs ?? 0),
    gross_mg: Number(r.gross_mg ?? 0),
    net_mg: Number(r.net_mg ?? 0),
    fine_mg: Number(r.fine_mg ?? 0),
    cost_paise: Number(r.cost_paise ?? 0),
  }));
}

export type BarcodePendingRow = {
  id: string;
  item_code: string;
  item_name: string;
  barcode: string;
  status: string;
  location: string;
  gross_mg: number;
  net_mg: number;
  fine_mg: number;
  lot_id: string;
  pending_reason: string;
  created_at: string;
};

export async function fetchBarcodePending(limit = 2000): Promise<{
  rows: BarcodePendingRow[];
  total: number;
  capped: boolean;
}> {
  const { data, error } = await supabase.rpc("get_barcode_pending" as never, {
    p_limit: limit,
  } as never);
  if (error) throw new Error(error.message);
  const payload = data as { rows?: BarcodePendingRow[]; total?: number; capped?: boolean };
  return {
    rows: (payload.rows ?? []).map((r) => ({
      ...r,
      gross_mg: Number(r.gross_mg ?? 0),
      net_mg: Number(r.net_mg ?? 0),
      fine_mg: Number(r.fine_mg ?? 0),
    })),
    total: Number(payload.total ?? 0),
    capped: !!payload.capped,
  };
}

export type DhadiBookRow = {
  date: string;
  voucher_no: string;
  worker_name: string;
  worker_id: string;
  item_name: string;
  j_n: string;
  jn_code: number;
  gr_wt_mg: number;
  less_wt_mg: number;
  net_wt_mg: number;
  fine_mg: number;
  tanch: number;
  pcs: number;
  remark: string;
};

export type DhadiBookResult = {
  rows: DhadiBookRow[];
  total: number;
  capped: boolean;
  issueFineMg: number;
  returnFineMg: number;
  pendingFineMg: number;
};

export async function fetchDhadiBook(
  range: DateRange,
  workerId?: string | null,
): Promise<DhadiBookResult> {
  const { data, error } = await supabase.rpc("get_dhadi_book" as never, {
    p_from: range.from || null,
    p_to: range.to || null,
    p_worker_id: workerId || null,
    p_limit: 2000,
  } as never);
  if (error) throw new Error(error.message);
  const p = data as Record<string, unknown>;
  const rows = ((p.rows as DhadiBookRow[]) ?? []).map((r) => ({
    ...r,
    jn_code: Number(r.jn_code ?? 0),
    gr_wt_mg: Number(r.gr_wt_mg ?? 0),
    less_wt_mg: Number(r.less_wt_mg ?? 0),
    net_wt_mg: Number(r.net_wt_mg ?? 0),
    fine_mg: Number(r.fine_mg ?? 0),
    tanch: Number(r.tanch ?? 0),
    pcs: Number(r.pcs ?? 0),
  }));
  return {
    rows,
    total: Number(p.total ?? 0),
    capped: !!p.capped,
    issueFineMg: Number(p.issueFineMg ?? 0),
    returnFineMg: Number(p.returnFineMg ?? 0),
    pendingFineMg: Number(p.pendingFineMg ?? 0),
  };
}
