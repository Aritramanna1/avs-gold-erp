import { dataProvider as supabase } from "@/lib/providers/data-provider";

export interface BranchKPIs {
  salesThisMonthPaise: number;
  invoiceCount: number;
  outstandingPaise: number;
  pendingOrders: number;
  activeJobCards: number;
  readyJobCards: number;
  pendingRepairs: number;
  totalCustomers: number;
}

type BranchKpiRpcRow = {
  sales_this_month_paise: number | string | null;
  invoice_count: number | string | null;
  outstanding_paise: number | string | null;
  pending_orders: number | string | null;
  active_job_cards: number | string | null;
  ready_job_cards: number | string | null;
  pending_repairs: number | string | null;
  total_customers: number | string | null;
};

type InvoiceTotalRow = {
  grand_total_paise: number | string | null;
  balance_paise: number | string | null;
};

function asNumber(value: number | string | null | undefined): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(parsed) ? Number(parsed) : 0;
}

function normalizeRpcRow(row: BranchKpiRpcRow | null | undefined): BranchKPIs {
  return {
    salesThisMonthPaise: asNumber(row?.sales_this_month_paise),
    invoiceCount: asNumber(row?.invoice_count),
    outstandingPaise: asNumber(row?.outstanding_paise),
    pendingOrders: asNumber(row?.pending_orders),
    activeJobCards: asNumber(row?.active_job_cards),
    readyJobCards: asNumber(row?.ready_job_cards),
    pendingRepairs: asNumber(row?.pending_repairs),
    totalCustomers: asNumber(row?.total_customers),
  };
}

function branchFilter(query: any, branchId: string) {
  return query.or(`branch_id.eq.${branchId},data->>branchId.eq.${branchId}`);
}

async function count(
  table: string,
  branchId: string,
  apply?: (query: any) => any,
): Promise<number> {
  let query = branchFilter(
    (supabase as any).from(table).select("id", { count: "exact", head: true }),
    branchId,
  );
  if (apply) query = apply(query);
  const { count: total, error } = await query;
  if (error) throw new Error(error.message);
  return total ?? 0;
}

async function fallbackBranchKPIs(branchId: string): Promise<BranchKPIs> {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [
    monthInvoicesResult,
    outstandingInvoicesResult,
    pendingOrders,
    activeJobCards,
    readyJobCards,
    pendingRepairs,
    totalCustomers,
  ] = await Promise.all([
    branchFilter(
      (supabase as any)
        .from("invoices")
        .select("grand_total_paise,balance_paise")
        .gte("created_at", monthStart)
        .neq("status", "cancelled")
        .limit(1000),
      branchId,
    ),
    branchFilter(
      (supabase as any)
        .from("invoices")
        .select("balance_paise")
        .gt("balance_paise", 0)
        .neq("status", "cancelled")
        .limit(1000),
      branchId,
    ),
    count("orders", branchId, (query) =>
      query.or(
        "status.in.(pending,in_progress,ready),data->>status.in.(pending,in_progress,ready)",
      ),
    ),
    count("job_cards", branchId, (query) =>
      query.or("status.in.(open,in_progress),data->>status.in.(open,in_progress)"),
    ),
    count("job_cards", branchId, (query) =>
      query.or("status.in.(ready,ready_for_billing),data->>status.in.(ready,ready_for_billing)"),
    ),
    count("repairs", branchId, (query) =>
      query
        .not("status", "in", "(delivered,cancelled)")
        .not("data->>status", "in", "(delivered,cancelled)"),
    ),
    count("people", branchId, (query) => query.or("type.eq.customer,data->>type.eq.customer")),
  ]);

  if (monthInvoicesResult.error) throw new Error(monthInvoicesResult.error.message);
  if (outstandingInvoicesResult.error) throw new Error(outstandingInvoicesResult.error.message);

  const monthInvoices = (monthInvoicesResult.data ?? []) as InvoiceTotalRow[];
  const outstandingInvoices = (outstandingInvoicesResult.data ?? []) as InvoiceTotalRow[];

  return {
    salesThisMonthPaise: monthInvoices.reduce(
      (sum, row) => sum + asNumber(row.grand_total_paise),
      0,
    ),
    invoiceCount: monthInvoices.length,
    outstandingPaise: outstandingInvoices.reduce(
      (sum, row) => sum + Math.max(0, asNumber(row.balance_paise)),
      0,
    ),
    pendingOrders,
    activeJobCards,
    readyJobCards,
    pendingRepairs,
    totalCustomers,
  };
}

export async function getBranchKPIs(branchId: string): Promise<BranchKPIs> {
  const { data, error } = await (supabase as any).rpc("get_ceo_branch_kpis", {
    p_branch_id: branchId,
  });

  if (!error) {
    const row = Array.isArray(data) ? data[0] : data;
    return normalizeRpcRow(row as BranchKpiRpcRow | null | undefined);
  }

  return fallbackBranchKPIs(branchId);
}
