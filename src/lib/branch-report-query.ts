import { dataProvider as supabase } from "@/lib/providers/data-provider";
import type { Branch } from "@/lib/settings-store";

export interface BranchReportInput {
  branches: Branch[];
  from: string;
  to: string;
}

export interface BranchReportRow {
  id: string;
  name: string;
  salesPaise: number;
  outstandingPaise: number;
  orders: number;
  repairs: number;
  customers: number;
}

const REPORT_LIMIT = 1000;

type InvoiceRow = {
  customer_id: string | null;
  grand_total_paise: number | string | null;
  balance_paise: number | string | null;
  data: Record<string, any> | null;
  created_at: string | null;
};

type DataRow = {
  data: Record<string, any> | null;
  created_at: string | null;
};

function branchOf(data: Record<string, any> | null): string {
  return String(data?.branchId ?? data?.branch_id ?? "MAIN");
}

function asDateStart(value: string): string {
  return `${value}T00:00:00.000Z`;
}

function asDateEnd(value: string): string {
  return `${value}T23:59:59.999Z`;
}

export async function fetchBranchReport(input: BranchReportInput): Promise<BranchReportRow[]> {
  const rowsByBranch = new Map<string, BranchReportRow>(
    input.branches.map((branch) => [
      branch.id,
      {
        id: branch.id,
        name: branch.name,
        salesPaise: 0,
        outstandingPaise: 0,
        orders: 0,
        repairs: 0,
        customers: 0,
      },
    ]),
  );
  const customerSets = new Map<string, Set<string>>();

  for (const branch of input.branches) {
    customerSets.set(branch.id, new Set());
  }

  const fromIso = asDateStart(input.from);
  const toIso = asDateEnd(input.to);
  const db = supabase as any;

  const [invoiceRes, orderRes, repairRes] = await Promise.all([
    db
      .from("invoices")
      .select("customer_id,grand_total_paise,balance_paise,data,created_at")
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(REPORT_LIMIT),
    db
      .from("orders")
      .select("data,created_at")
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("created_at", { ascending: false })
      .limit(REPORT_LIMIT),
    db
      .from("repairs")
      .select("data,created_at")
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("created_at", { ascending: false })
      .limit(REPORT_LIMIT),
  ]);

  if (invoiceRes.error) throw new Error(invoiceRes.error.message ?? "Could not load invoices.");
  if (orderRes.error) throw new Error(orderRes.error.message ?? "Could not load orders.");
  if (repairRes.error) throw new Error(repairRes.error.message ?? "Could not load repairs.");

  for (const invoice of (invoiceRes.data ?? []) as InvoiceRow[]) {
    const branchId = branchOf(invoice.data);
    const row = rowsByBranch.get(branchId);
    if (!row) continue;
    row.salesPaise += Number(invoice.grand_total_paise ?? invoice.data?.grandTotalPaise ?? 0);
    row.outstandingPaise += Number(invoice.balance_paise ?? invoice.data?.balancePaise ?? 0);
    const customerId = invoice.customer_id ?? invoice.data?.customerId;
    if (customerId) customerSets.get(branchId)?.add(String(customerId));
  }

  for (const order of (orderRes.data ?? []) as DataRow[]) {
    const row = rowsByBranch.get(branchOf(order.data));
    if (row) row.orders += 1;
  }

  for (const repair of (repairRes.data ?? []) as DataRow[]) {
    const row = rowsByBranch.get(branchOf(repair.data));
    if (row) row.repairs += 1;
  }

  return [...rowsByBranch.values()].map((row) => ({
    ...row,
    customers: customerSets.get(row.id)?.size ?? 0,
  }));
}
