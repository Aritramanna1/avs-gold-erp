/**
 * Server-backed Karigar Book (Offline Dhadi_jn / custody semantics).
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import type { DateRange } from "@/lib/report-engine";

export type KarigarBookRow = {
  id: string;
  date: string;
  entry_no: string;
  worker_id: string;
  worker_name: string;
  particulars: string;
  j_n: string;
  jn_code: number;
  gross_mg: number;
  less_mg: number;
  add_mg: number;
  net_mg: number;
  fine_mg: number;
  purity: number;
  wastage_pct: number;
  hisob_pct: number;
  plus_fine_mg: number;
  labour_cash_paise: number;
  process_type: string;
  stamp_code: string;
  dhadi_group_name: string;
  order_no: string;
  remark: string;
};

export type KarigarBookSummary = {
  worker_id: string;
  worker_name: string;
  issue_fine_mg: number;
  return_fine_mg: number;
  pending_fine_mg: number;
  labour_cash_paise: number;
  entry_count: number;
};

export type KarigarBookResult = {
  rows: KarigarBookRow[];
  summaries: KarigarBookSummary[];
  total: number;
  capped: boolean;
};

function num(v: unknown): number {
  return Number(v ?? 0);
}

export async function fetchKarigarBook(opts: {
  range?: DateRange;
  workerId?: string | null;
}): Promise<KarigarBookResult> {
  const { data, error } = await supabase.rpc("get_karigar_book" as never, {
    p_worker_id: opts.workerId || null,
    p_from: opts.range?.from || null,
    p_to: opts.range?.to || null,
    p_limit: 2000,
  } as never);
  if (error) throw new Error(error.message);
  const p = data as Record<string, unknown>;
  const rows = ((p.rows as KarigarBookRow[]) ?? []).map((r) => ({
    ...r,
    jn_code: num(r.jn_code),
    gross_mg: num(r.gross_mg),
    less_mg: num(r.less_mg),
    add_mg: num(r.add_mg),
    net_mg: num(r.net_mg),
    fine_mg: num(r.fine_mg),
    purity: num(r.purity),
    wastage_pct: num(r.wastage_pct),
    hisob_pct: num(r.hisob_pct),
    plus_fine_mg: num(r.plus_fine_mg),
    labour_cash_paise: num(r.labour_cash_paise),
  }));
  const summaries = ((p.summaries as KarigarBookSummary[]) ?? []).map((s) => ({
    ...s,
    issue_fine_mg: num(s.issue_fine_mg),
    return_fine_mg: num(s.return_fine_mg),
    pending_fine_mg: num(s.pending_fine_mg),
    labour_cash_paise: num(s.labour_cash_paise),
    entry_count: num(s.entry_count),
  }));
  return {
    rows,
    summaries,
    total: num(p.total),
    capped: !!p.capped,
  };
}
