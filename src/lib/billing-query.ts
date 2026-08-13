import { dataProvider as supabase } from "@/lib/providers/data-provider";
import type { Invoice, InvoiceStatus } from "@/lib/billing-store";

export interface BillingPageQuery {
  page?: number;
  pageSize?: number;
  query?: string;
  branchId?: string | null;
}

export interface BillingPageResult {
  invoices: Invoice[];
  page: number;
  pageSize: number;
  totalCount: number;
  collectedPaise: number;
  outstandingPaise: number;
}

export interface BillingOutstandingRow {
  customerId: string;
  customerName: string;
  phone?: string;
  amount: number;
  days: number;
  latestInv: string;
  latestInvoiceId: string;
}

type InvoiceRow = {
  id: string;
  invoice_no: string | null;
  customer_id: string | null;
  order_id: string | null;
  status: InvoiceStatus | string | null;
  subtotal_paise: number | null;
  gst_paise: number | null;
  grand_total_paise: number | null;
  paid_paise: number | null;
  balance_paise: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  data: Partial<Invoice> | null;
};

type BillingOutstandingRpcRow = {
  customer_id: string | null;
  customer_name: string | null;
  phone: string | null;
  amount_paise: number | string | null;
  oldest_created_at: string | null;
  latest_invoice_id: string | null;
  latest_invoice_no: string | null;
};

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function clampPage(value: number | undefined): number {
  if (!Number.isFinite(value) || !value || value < 1) return 1;
  return Math.floor(value);
}

function clampPageSize(value: number | undefined): number {
  if (!Number.isFinite(value) || !value) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(10, Math.floor(value)));
}

function remoteLike(query: string): string {
  const cleaned = query.trim().replace(/[,%]/g, " ").replace(/\s+/g, " ").slice(0, 80);
  return `%${cleaned}%`;
}

function rowToInvoice(row: InvoiceRow): Invoice | null {
  const data = row.data ?? {};
  const id = data.id ?? row.id;
  const invoiceNo = data.invoiceNo ?? row.invoice_no ?? "";
  if (!id || !invoiceNo) return null;

  return {
    id,
    invoiceNo,
    createdAt: data.createdAt ?? (Date.parse(row.created_at ?? "") || Date.now()),
    updatedAt: data.updatedAt ?? (Date.parse(row.updated_at ?? "") || Date.now()),
    status: (data.status ?? row.status ?? "draft") as InvoiceStatus,
    billingType: data.billingType,
    customerId: data.customerId ?? row.customer_id ?? "",
    customerName: data.customerName ?? "",
    customerPhone: data.customerPhone,
    customerGstin: data.customerGstin,
    orderId: data.orderId ?? row.order_id ?? undefined,
    orderNo: data.orderNo,
    jobId: data.jobId,
    jobNo: data.jobNo,
    items: data.items ?? [],
    orderAdjustment: data.orderAdjustment,
    gst: data.gst ?? "gst3",
    cgstPaise: data.cgstPaise ?? 0,
    sgstPaise: data.sgstPaise ?? 0,
    gstPaise: data.gstPaise ?? row.gst_paise ?? 0,
    tcsPaise: data.tcsPaise ?? 0,
    gstGoldEquivalentMg: data.gstGoldEquivalentMg,
    subtotalPaise: data.subtotalPaise ?? row.subtotal_paise ?? 0,
    adjustmentPaise: data.adjustmentPaise ?? 0,
    grandTotalPaise: data.grandTotalPaise ?? row.grand_total_paise ?? 0,
    paidPaise: data.paidPaise ?? row.paid_paise ?? 0,
    balancePaise: data.balancePaise ?? row.balance_paise ?? 0,
    payments: data.payments ?? [],
    notes: data.notes,
    branchId: data.branchId,
    saleLedgerEntryId: data.saleLedgerEntryId,
    additionalLedgerEntryIds: data.additionalLedgerEntryIds,
    cancelledAt: data.cancelledAt,
    cancelledReason: data.cancelledReason,
    cancelledBy: data.cancelledBy,
  };
}

export async function fetchBillingInvoiceById(id: string): Promise<Invoice | null> {
  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id,invoice_no,customer_id,order_id,status,subtotal_paise,gst_paise,grand_total_paise,paid_paise,balance_paise,created_at,updated_at,data",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message ?? "Could not load invoice.");
  return data ? rowToInvoice(data as InvoiceRow) : null;
}

export async function fetchBillingCustomerContact(customerId?: string | null): Promise<{
  phone?: string;
  email?: string;
} | null> {
  if (!customerId) return null;
  const { data, error } = await supabase
    .from("people")
    .select("phone, data")
    .eq("id", customerId)
    .maybeSingle();

  if (error) throw new Error(error.message ?? "Could not load customer contact.");
  if (!data) return null;
  const raw = data as { phone?: string | null; data?: { phone?: string; email?: string } | null };
  return {
    phone: raw.data?.phone ?? raw.phone ?? undefined,
    email: raw.data?.email ?? undefined,
  };
}

function applyFilters(query: any, input: BillingPageQuery) {
  let next = query;
  if (input.branchId) next = next.filter("data->>branchId", "eq", input.branchId);
  const q = input.query?.trim();
  if (q) {
    const like = remoteLike(q);
    next = next.or(
      `invoice_no.ilike.${like},status.ilike.${like},data->>customerName.ilike.${like},data->>customerPhone.ilike.${like},data->>orderNo.ilike.${like}`,
    );
  }
  return next;
}

export async function fetchBillingInvoicePage(
  input: BillingPageQuery = {},
): Promise<BillingPageResult> {
  const page = clampPage(input.page);
  const pageSize = clampPageSize(input.pageSize);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const db = supabase as any;
  const select =
    "id,invoice_no,customer_id,order_id,status,subtotal_paise,gst_paise,grand_total_paise,paid_paise,balance_paise,created_at,updated_at,data";

  const [pageResult, collectedResult, outstandingResult] = await Promise.all([
    applyFilters(
      db
        .from("invoices")
        .select(select, { count: "exact" })
        .order("updated_at", { ascending: false })
        .range(from, to),
      input,
    ),
    applyFilters(db.from("invoices").select("paid_paise").neq("status", "cancelled"), input),
    applyFilters(db.from("invoices").select("balance_paise").neq("status", "cancelled"), input),
  ]);

  if (pageResult.error) throw new Error(pageResult.error.message ?? "Could not load invoices.");
  if (collectedResult.error) {
    throw new Error(collectedResult.error.message ?? "Could not load billing totals.");
  }
  if (outstandingResult.error) {
    throw new Error(outstandingResult.error.message ?? "Could not load billing totals.");
  }

  const invoices = ((pageResult.data ?? []) as InvoiceRow[])
    .map(rowToInvoice)
    .filter((invoice): invoice is Invoice => !!invoice);

  return {
    invoices,
    page,
    pageSize,
    totalCount: pageResult.count ?? invoices.length,
    collectedPaise: ((collectedResult.data ?? []) as Array<{ paid_paise: number | null }>).reduce(
      (sum, row) => sum + Number(row.paid_paise ?? 0),
      0,
    ),
    outstandingPaise: (
      (outstandingResult.data ?? []) as Array<{ balance_paise: number | null }>
    ).reduce((sum, row) => sum + Number(row.balance_paise ?? 0), 0),
  };
}

function outstandingFromRows(rows: Invoice[]): BillingOutstandingRow[] {
  const map = new Map<string, BillingOutstandingRow>();
  const now = Date.now();

  for (const inv of rows) {
    if (inv.balancePaise <= 0 || inv.status === "cancelled") continue;
    const key = inv.customerId || "walk_in";
    const days = Math.floor((now - inv.createdAt) / 86400000);
    const existing = map.get(key);
    if (existing) {
      existing.amount += inv.balancePaise;
      existing.days = Math.max(existing.days, days);
      if (inv.createdAt >= (rows.find((r) => r.id === existing.latestInvoiceId)?.createdAt ?? 0)) {
        existing.latestInv = inv.invoiceNo;
        existing.latestInvoiceId = inv.id;
      }
    } else {
      map.set(key, {
        customerId: key,
        customerName: inv.customerName || "Walk-in Customer",
        phone: inv.customerPhone,
        amount: inv.balancePaise,
        days,
        latestInv: inv.invoiceNo,
        latestInvoiceId: inv.id,
      });
    }
  }

  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

export async function fetchBillingOutstandingSummary(
  input: Pick<BillingPageQuery, "branchId"> = {},
): Promise<BillingOutstandingRow[]> {
  const db = supabase as any;
  const rpcResult = await db.rpc("get_billing_outstanding_summary", {
    p_branch_id: input.branchId ?? null,
  });

  if (!rpcResult.error) {
    const now = Date.now();
    return ((rpcResult.data ?? []) as BillingOutstandingRpcRow[]).map((row) => ({
      customerId: row.customer_id ?? "walk_in",
      customerName: row.customer_name ?? "Walk-in Customer",
      phone: row.phone ?? undefined,
      amount: Number(row.amount_paise ?? 0),
      days: Math.max(
        0,
        Math.floor((now - (Date.parse(row.oldest_created_at ?? "") || now)) / 86400000),
      ),
      latestInv: row.latest_invoice_no ?? "",
      latestInvoiceId: row.latest_invoice_id ?? "",
    }));
  }

  let fallback = db
    .from("invoices")
    .select(
      "id,invoice_no,customer_id,order_id,status,subtotal_paise,gst_paise,grand_total_paise,paid_paise,balance_paise,created_at,updated_at,data",
    )
    .neq("status", "cancelled")
    .gt("balance_paise", 0)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (input.branchId) fallback = fallback.filter("data->>branchId", "eq", input.branchId);

  const fallbackResult = await fallback;
  if (fallbackResult.error) {
    throw new Error(fallbackResult.error.message ?? "Could not load outstanding balances.");
  }

  const invoices = ((fallbackResult.data ?? []) as InvoiceRow[])
    .map(rowToInvoice)
    .filter((invoice): invoice is Invoice => !!invoice);
  return outstandingFromRows(invoices);
}
