import { dataProvider as supabase } from "@/lib/providers/data-provider";

const HOME_ROW_LIMIT = 500;

export interface HomeDashboardOrder {
  id: string;
  orderNo: string;
  status: string;
  type: string;
  expectedDelivery?: string;
  customerId?: string;
  karigarId?: string;
  item?: { itemName?: string };
}

export interface HomeDashboardPerson {
  id: string;
  fullName: string;
  phone?: string;
}

export interface HomeDashboardBuckets {
  today: HomeDashboardOrder[];
  tomorrow: HomeDashboardOrder[];
  delayed: HomeDashboardOrder[];
  pendingJobCard: HomeDashboardOrder[];
  readyBilling: HomeDashboardOrder[];
}

export interface HomeDashboardSummary {
  buckets: HomeDashboardBuckets;
  people: HomeDashboardPerson[];
  goldBuckets: {
    vault: number;
    karigar: number;
    finished: number;
    customer: number;
    jeweller: number;
    scrap: number;
  };
  ledgerBalanced: boolean;
  ledgerDiscrepancyMg: number;
  openOrders: number;
  totalOrders: number;
  stockCount: number;
  todayBillingPaise: number;
  todayInvoiceCount: number;
  totalInvoiceCount: number;
  todayCashPaise: number;
  todayUpiPaise: number;
  todayCardPaise: number;
  todayGoldPaidPaise: number;
  todayOutstandingPaise: number;
  todayGoldSoldMg: number;
  capped: boolean;
}

function ymd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function todayYmd(): string {
  return ymd(new Date());
}

function tomorrowYmd(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return ymd(d);
}

function asNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function asPayload(row: { data?: unknown }): Record<string, any> {
  return row.data && typeof row.data === "object" ? (row.data as Record<string, any>) : {};
}

function emptyBuckets(): HomeDashboardBuckets {
  return { today: [], tomorrow: [], delayed: [], pendingJobCard: [], readyBilling: [] };
}

export async function fetchHomeDashboardSummary(): Promise<HomeDashboardSummary> {
  const db = supabase as any;
  const { data, error } = await db.rpc("get_home_dashboard_summary");
  if (!error && data?.[0]) return mapRpcSummary(data[0]);
  return fetchHomeDashboardSummaryFallback();
}

function mapRpcSummary(row: any): HomeDashboardSummary {
  return {
    buckets: emptyBuckets(),
    people: [],
    goldBuckets: {
      vault: asNumber(row.vault_gold_mg),
      karigar: asNumber(row.karigar_gold_mg),
      finished: asNumber(row.finished_gold_mg),
      customer: asNumber(row.customer_gold_mg),
      jeweller: asNumber(row.jeweller_gold_mg),
      scrap: asNumber(row.scrap_gold_mg),
    },
    ledgerBalanced: asNumber(row.ledger_discrepancy_mg) === 0,
    ledgerDiscrepancyMg: asNumber(row.ledger_discrepancy_mg),
    openOrders: asNumber(row.open_orders),
    totalOrders: asNumber(row.total_orders),
    stockCount: asNumber(row.available_stock_count),
    todayBillingPaise: asNumber(row.today_billing_paise),
    todayInvoiceCount: asNumber(row.today_invoice_count),
    totalInvoiceCount: asNumber(row.total_invoice_count),
    todayCashPaise: asNumber(row.today_cash_paise),
    todayUpiPaise: asNumber(row.today_upi_paise),
    todayCardPaise: asNumber(row.today_card_paise),
    todayGoldPaidPaise: asNumber(row.today_gold_paid_paise),
    todayOutstandingPaise: asNumber(row.today_outstanding_paise),
    todayGoldSoldMg: asNumber(row.today_gold_sold_mg),
    capped: false,
  };
}

async function fetchHomeDashboardSummaryFallback(): Promise<HomeDashboardSummary> {
  const today = todayYmd();
  const tomorrow = tomorrowYmd();
  const [
    orderRowsResult,
    linkedJobsResult,
    ledgerResult,
    stockCountResult,
    openOrdersResult,
    totalOrdersResult,
    todayInvoicesResult,
    totalInvoicesResult,
  ] = await Promise.all([
    (supabase as any)
      .from("orders")
      .select("id,order_no,status,type,customer_id,karigar_id,expected_delivery,data")
      .neq("status", "delivered")
      .neq("status", "cancelled")
      .order("expected_delivery", { ascending: true, nullsFirst: false })
      .limit(HOME_ROW_LIMIT),
    (supabase as any)
      .from("job_cards")
      .select("order_id")
      .not("order_id", "is", null)
      .limit(HOME_ROW_LIMIT),
    (supabase as any).from("gold_ledger").select("net_fine_mg,bucket_deltas").limit(HOME_ROW_LIMIT),
    (supabase as any)
      .from("inventory")
      .select("id", { count: "exact", head: true })
      .eq("status", "available"),
    (supabase as any)
      .from("orders")
      .select("id", { count: "exact", head: true })
      .not("status", "in", "(delivered,cancelled)"),
    (supabase as any).from("orders").select("id", { count: "exact", head: true }),
    (supabase as any)
      .from("invoices")
      .select("grand_total_paise,balance_paise,data,created_at")
      .gte("created_at", `${today}T00:00:00`)
      .lt("created_at", `${tomorrow}T00:00:00`)
      .limit(HOME_ROW_LIMIT),
    (supabase as any).from("invoices").select("id", { count: "exact", head: true }),
  ]);

  const firstError = [
    orderRowsResult,
    linkedJobsResult,
    ledgerResult,
    stockCountResult,
    openOrdersResult,
    totalOrdersResult,
    todayInvoicesResult,
    totalInvoicesResult,
  ].find((result) => result.error)?.error;
  if (firstError) throw firstError;

  const linkedOrderIds = new Set<string>(
    (linkedJobsResult.data ?? []).map((row: any) => String(row.order_id)).filter(Boolean),
  );
  const orders = (orderRowsResult.data ?? []).map(mapOrderRow);
  const buckets = buildBuckets(orders, linkedOrderIds, today, tomorrow);
  const people = await fetchDashboardPeople(orders);

  const goldBuckets = { vault: 0, karigar: 0, finished: 0, customer: 0, jeweller: 0, scrap: 0 };
  let ledgerTotal = 0;
  for (const row of ledgerResult.data ?? []) {
    ledgerTotal += asNumber(row.net_fine_mg);
    const deltas =
      row.bucket_deltas && typeof row.bucket_deltas === "object" ? row.bucket_deltas : {};
    goldBuckets.vault += asNumber(deltas.vault);
    goldBuckets.karigar += asNumber(deltas.karigar);
    goldBuckets.finished += asNumber(deltas.finished);
    goldBuckets.customer += asNumber(deltas.customer);
    goldBuckets.jeweller += asNumber(deltas.jeweller);
    goldBuckets.scrap += asNumber(deltas.scrap);
  }
  const bucketTotal = Object.values(goldBuckets).reduce((sum, value) => sum + value, 0);

  const todayTotals = computeTodayInvoiceTotals(todayInvoicesResult.data ?? []);

  return {
    buckets,
    people,
    goldBuckets,
    ledgerBalanced: ledgerTotal === bucketTotal,
    ledgerDiscrepancyMg: ledgerTotal - bucketTotal,
    openOrders: openOrdersResult.count ?? orders.length,
    totalOrders: totalOrdersResult.count ?? orders.length,
    stockCount: stockCountResult.count ?? 0,
    todayBillingPaise: todayTotals.billingPaise,
    todayInvoiceCount: todayInvoicesResult.data?.length ?? 0,
    totalInvoiceCount: totalInvoicesResult.count ?? 0,
    todayCashPaise: todayTotals.cashPaise,
    todayUpiPaise: todayTotals.upiPaise,
    todayCardPaise: todayTotals.cardPaise,
    todayGoldPaidPaise: todayTotals.goldPaidPaise,
    todayOutstandingPaise: todayTotals.outstandingPaise,
    todayGoldSoldMg: todayTotals.goldSoldMg,
    capped:
      (orderRowsResult.data?.length ?? 0) >= HOME_ROW_LIMIT ||
      (linkedJobsResult.data?.length ?? 0) >= HOME_ROW_LIMIT ||
      (ledgerResult.data?.length ?? 0) >= HOME_ROW_LIMIT ||
      (todayInvoicesResult.data?.length ?? 0) >= HOME_ROW_LIMIT,
  };
}

function mapOrderRow(row: any): HomeDashboardOrder {
  const payload = asPayload(row);
  return {
    id: String(row.id),
    orderNo: String(row.order_no ?? payload.orderNo ?? row.id),
    status: String(row.status ?? payload.status ?? ""),
    type: String(row.type ?? payload.type ?? ""),
    expectedDelivery: row.expected_delivery ?? payload.expectedDelivery,
    customerId: row.customer_id ?? payload.customerId,
    karigarId: row.karigar_id ?? payload.karigarId,
    item: payload.item ?? { itemName: payload.itemName },
  };
}

function buildBuckets(
  orders: HomeDashboardOrder[],
  linkedOrderIds: Set<string>,
  today: string,
  tomorrow: string,
): HomeDashboardBuckets {
  const buckets = emptyBuckets();
  for (const order of orders) {
    if (order.expectedDelivery && order.expectedDelivery < today) buckets.delayed.push(order);
    else if (order.expectedDelivery === today) buckets.today.push(order);
    else if (order.expectedDelivery === tomorrow) buckets.tomorrow.push(order);
    if (
      (order.status === "confirmed" ||
        order.status === "awaiting_job_card" ||
        order.status === "draft") &&
      !linkedOrderIds.has(order.id) &&
      order.type === "custom"
    ) {
      buckets.pendingJobCard.push(order);
    }
    if (order.status === "ready_billing") buckets.readyBilling.push(order);
  }
  return buckets;
}

async function fetchDashboardPeople(orders: HomeDashboardOrder[]): Promise<HomeDashboardPerson[]> {
  const ids = Array.from(
    new Set(
      orders.flatMap((order) => [order.customerId, order.karigarId]).filter(Boolean) as string[],
    ),
  ).slice(0, HOME_ROW_LIMIT);
  if (ids.length === 0) return [];
  const { data, error } = await (supabase as any)
    .from("people")
    .select("id,full_name,phone")
    .in("id", ids)
    .limit(HOME_ROW_LIMIT);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    fullName: String(row.full_name ?? row.id),
    phone: row.phone ?? undefined,
  }));
}

function computeTodayInvoiceTotals(rows: any[]) {
  return rows.reduce(
    (acc, row) => {
      const payload = asPayload(row);
      const payments = Array.isArray(payload.payments) ? payload.payments : [];
      const items = Array.isArray(payload.items) ? payload.items : [];
      acc.billingPaise += asNumber(row.grand_total_paise ?? payload.grandTotalPaise);
      acc.outstandingPaise += Math.max(0, asNumber(row.balance_paise ?? payload.balancePaise));
      acc.cashPaise += sumPayments(payments, ["cash"]);
      acc.upiPaise += sumPayments(payments, ["upi"]);
      acc.cardPaise += sumPayments(payments, ["card"]);
      acc.goldPaidPaise += sumPayments(payments, ["gold_exchange", "customer_gold_credit"]);
      acc.goldSoldMg += items.reduce((sum: number, item: any) => sum + asNumber(item.fineMg), 0);
      return acc;
    },
    {
      billingPaise: 0,
      outstandingPaise: 0,
      cashPaise: 0,
      upiPaise: 0,
      cardPaise: 0,
      goldPaidPaise: 0,
      goldSoldMg: 0,
    },
  );
}

function sumPayments(payments: any[], modes: string[]): number {
  return payments
    .filter((payment) => modes.includes(String(payment.mode)))
    .reduce((sum, payment) => sum + asNumber(payment.amountPaise), 0);
}
