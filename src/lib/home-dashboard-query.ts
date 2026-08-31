import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { beginEgressOperation } from "@/lib/monitoring/supabase-egress-monitor";
import { useOrders, type Order } from "@/lib/orders-store";
import { useJobCards } from "@/lib/jobcards-store";
import { usePeople } from "@/lib/people-store";
import { useAppLoading } from "@/lib/app-loading-store";

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
  loadWarning?: string;
  /** True when fallback path already hydrated order buckets (skip second fetch). */
  includesOrderBuckets?: boolean;
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

export const HOME_DASHBOARD_TIMEOUT_MS = 25_000;

export function describeDashboardError(error: unknown): string {
  if (error instanceof Error && error.name === "AbortError") {
    return "Dashboard request was cancelled.";
  }
  const anyErr = error as { code?: string; message?: string; status?: number };
  const code = anyErr?.code ?? "";
  const message = anyErr?.message ?? (error instanceof Error ? error.message : String(error));
  if (
    code === "EGRESS_QUARANTINE" ||
    /egress quarantined/i.test(message) ||
    anyErr?.status === 503
  ) {
    return "Dev mode blocked Supabase calls. Set VITE_ENABLE_DEV_SUPABASE=1 in .env.local and restart npm run dev.";
  }
  if (code === "PGRST202" || /could not find the function/i.test(message)) {
    return `Dashboard RPC get_home_dashboard_summary is missing (${code || "PGRST202"}).`;
  }
  if (code === "42501" || /permission denied/i.test(message)) {
    return `Dashboard query was denied by RLS/permissions (${code || "42501"}).`;
  }
  if (code === "57014" || /statement timeout/i.test(message)) {
    return `Dashboard query timed out on the database (${code || "57014"}).`;
  }
  return `Dashboard could not load: ${message}${code ? ` [${code}]` : ""}`;
}

function isMissingRpc(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "PGRST202" || /could not find the function/i.test(error.message ?? "");
}

function isTimeoutRpc(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "57014" || /statement timeout/i.test(error.message ?? "");
}

export function emptyHomeDashboardSummary(): HomeDashboardSummary {
  return {
    buckets: emptyBuckets(),
    people: [],
    goldBuckets: { vault: 0, karigar: 0, finished: 0, customer: 0, jeweller: 0, scrap: 0 },
    ledgerBalanced: true,
    ledgerDiscrepancyMg: 0,
    openOrders: 0,
    totalOrders: 0,
    stockCount: 0,
    todayBillingPaise: 0,
    todayInvoiceCount: 0,
    totalInvoiceCount: 0,
    todayCashPaise: 0,
    todayUpiPaise: 0,
    todayCardPaise: 0,
    todayGoldPaidPaise: 0,
    todayOutstandingPaise: 0,
    todayGoldSoldMg: 0,
    capped: false,
  };
}

let summaryInFlight: Promise<HomeDashboardSummary> | null = null;

export async function fetchHomeDashboardSummary(signal?: AbortSignal): Promise<HomeDashboardSummary> {
  if (summaryInFlight) return summaryInFlight;
  summaryInFlight = fetchHomeDashboardSummaryInner(signal).finally(() => {
    summaryInFlight = null;
  });
  return summaryInFlight;
}

function isEgressQuarantine(error: { code?: string; message?: string; status?: number } | null): boolean {
  if (!error) return false;
  return (
    error.code === "EGRESS_QUARANTINE" ||
    /egress quarantined/i.test(error.message ?? "") ||
    error.status === 503
  );
}

async function fetchHomeDashboardSummaryInner(signal?: AbortSignal): Promise<HomeDashboardSummary> {
  const zeros = emptyHomeDashboardSummary();
  const op = beginEgressOperation("dashboard_summary");
  try {
    const db = supabase as any;
    const { data, error } = await db.rpc(
      "get_home_dashboard_summary",
      {},
      signal ? { abortSignal: signal } : undefined,
    );
    if (error) {
      if (isEgressQuarantine(error)) {
        const msg = describeDashboardError(error);
        op.finish(false, msg);
        throw new Error(msg);
      }
      if (isMissingRpc(error) || isTimeoutRpc(error)) {
        try {
          const fallback = await fetchHomeDashboardSummaryFallback();
          op.finish(true, "fallback");
          return fallback;
        } catch (fallbackErr) {
          const msg = describeDashboardError(fallbackErr);
          op.finish(false, msg);
          return { ...zeros, loadWarning: msg };
        }
      }
      const msg = describeDashboardError(error);
      op.finish(false, msg);
      return { ...zeros, loadWarning: msg };
    }
    const row = Array.isArray(data) ? data[0] : data;
    const summary = mapRpcSummary(row ?? {});
    try {
      // Bucket query is separate from KPI RPC — do not abort on route remount/StrictMode
      // or the delayed-order badge silently disappears while KPI cards remain populated.
      const buckets = await fetchOrderBucketsOnly();
      op.finish(true);
      return {
        ...summary,
        buckets: buckets.buckets,
        people: buckets.people,
        capped: buckets.capped,
        includesOrderBuckets: true,
      };
    } catch (bucketErr) {
      const msg = describeDashboardError(bucketErr);
      op.finish(true, `buckets_failed:${msg}`);
      return { ...summary, loadWarning: msg };
    }
  } catch (err) {
    const msg = describeDashboardError(err);
    op.finish(false, msg);
    return { ...zeros, loadWarning: msg };
  }
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

/** Lazy dashboard slice — order delivery buckets (separate from KPI RPC to save egress). */
export async function fetchDashboardOrderBuckets(
  signal?: AbortSignal,
): Promise<Pick<HomeDashboardSummary, "buckets" | "people" | "capped">> {
  const fromStores = tryBuildDashboardBucketsFromStores();
  if (fromStores) return fromStores;
  return fetchOrderBucketsOnly(signal);
}

/** Build delivery buckets from boot-hydrated stores — avoids duplicate REST on /app. */
export function tryBuildDashboardBucketsFromStores(): Pick<
  HomeDashboardSummary,
  "buckets" | "people" | "capped"
> | null {
  if (!useAppLoading.getState().initialLoadDone) return null;

  const today = todayYmd();
  const tomorrow = tomorrowYmd();
  const linkedOrderIds = new Set<string>(
    useJobCards
      .getState()
      .jobs.map((j) => j.orderId)
      .filter(Boolean),
  );
  const mapped = useOrders
    .getState()
    .orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled")
    .slice(0, HOME_ROW_LIMIT)
    .map(mapOrderFromStore);
  const buckets = buildBuckets(mapped, linkedOrderIds, today, tomorrow);
  const people = buildPeopleFromStore(mapped);
  return {
    buckets,
    people,
    capped: useOrders.getState().orders.length >= HOME_ROW_LIMIT,
  };
}

function mapOrderFromStore(order: Order): HomeDashboardOrder {
  return {
    id: order.id,
    orderNo: order.orderNo,
    status: order.status,
    type: order.type,
    expectedDelivery: order.expectedDelivery,
    customerId: order.customerId,
    karigarId: order.karigarId,
    item: order.item ?? order.items?.[0],
  };
}

function buildPeopleFromStore(orders: HomeDashboardOrder[]): HomeDashboardPerson[] {
  const ids = new Set(
    orders.flatMap((o) => [o.customerId, o.karigarId]).filter(Boolean) as string[],
  );
  if (ids.size === 0) return [];
  return usePeople
    .getState()
    .people.filter((p) => ids.has(p.id))
    .slice(0, HOME_ROW_LIMIT)
    .map((p) => ({
      id: p.id,
      fullName: p.fullName ?? p.id,
      phone: p.phone,
    }));
}

async function fetchOrderBucketsOnly(
  signal?: AbortSignal,
): Promise<Pick<HomeDashboardSummary, "buckets" | "people" | "capped">> {
  const today = todayYmd();
  const tomorrow = tomorrowYmd();
  let ordersQuery = (supabase as any)
    .from("orders")
    .select("id,order_no,status,type,customer_id,karigar_id,expected_delivery,data")
    .neq("status", "delivered")
    .neq("status", "cancelled")
    .order("expected_delivery", { ascending: true, nullsFirst: false })
    .limit(HOME_ROW_LIMIT);
  let jobsQuery = (supabase as any)
    .from("job_cards")
    .select("order_id")
    .not("order_id", "is", null)
    .limit(HOME_ROW_LIMIT);
  if (signal) {
    ordersQuery = ordersQuery.abortSignal(signal);
    jobsQuery = jobsQuery.abortSignal(signal);
  }
  const [orderRowsResult, linkedJobsResult] = await Promise.all([ordersQuery, jobsQuery]);
  if (orderRowsResult.error) throw orderRowsResult.error;
  if (linkedJobsResult.error) throw linkedJobsResult.error;
  const linkedOrderIds = new Set<string>(
    (linkedJobsResult.data ?? []).map((row: any) => String(row.order_id)).filter(Boolean),
  );
  const orders = (orderRowsResult.data ?? []).map(mapOrderRow);
  return {
    buckets: buildBuckets(orders, linkedOrderIds, today, tomorrow),
    people: await fetchDashboardPeople(orders).catch(() => [] as HomeDashboardPerson[]),
    capped:
      (orderRowsResult.data?.length ?? 0) >= HOME_ROW_LIMIT ||
      (linkedJobsResult.data?.length ?? 0) >= HOME_ROW_LIMIT,
  };
}

async function fetchHomeDashboardSummaryFallback(): Promise<HomeDashboardSummary> {
  const { resolveCurrentFirmId } = await import("@/lib/firm-scoped-app-settings");
  const firmId = await resolveCurrentFirmId().catch(() => null);
  if (!firmId) {
    return { ...emptyHomeDashboardSummary(), loadWarning: "Dashboard query: firm scope unavailable." };
  }

  const today = todayYmd();
  const tomorrow = tomorrowYmd();
  const firm = (q: any) => q.eq("firm_id", firmId);
  const [
    orderRowsResult,
    linkedJobsResult,
    stockCountResult,
    openOrdersResult,
    totalOrdersResult,
    todayInvoicesResult,
    todayInvoiceCountResult,
    totalInvoicesResult,
    ledgerBalances,
  ] = await Promise.all([
    firm(
      (supabase as any)
        .from("orders")
        .select("id,order_no,status,type,customer_id,karigar_id,expected_delivery,data")
        .neq("status", "delivered")
        .neq("status", "cancelled")
        .order("expected_delivery", { ascending: true, nullsFirst: false })
        .limit(HOME_ROW_LIMIT),
    ),
    firm(
      (supabase as any)
        .from("job_cards")
        .select("order_id")
        .not("order_id", "is", null)
        .limit(HOME_ROW_LIMIT),
    ),
    firm(
      (supabase as any)
        .from("inventory")
        .select("id", { count: "exact", head: true })
        .eq("status", "available"),
    ),
    firm(
      (supabase as any)
        .from("orders")
        .select("id", { count: "exact", head: true })
        .not("status", "in", "(delivered,cancelled)"),
    ),
    firm((supabase as any).from("orders").select("id", { count: "exact", head: true })),
    firm(
      (supabase as any)
        .from("invoices")
        .select("grand_total_paise,balance_paise,data,created_at")
        .gte("created_at", `${today}T00:00:00`)
        .lt("created_at", `${tomorrow}T00:00:00`)
        .limit(HOME_ROW_LIMIT),
    ),
    firm(
      (supabase as any)
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .gte("created_at", `${today}T00:00:00`)
        .lt("created_at", `${tomorrow}T00:00:00`),
    ),
    firm((supabase as any).from("invoices").select("id", { count: "exact", head: true })),
    import("@/lib/ledger-pagination").then((m) => m.fetchFirmLedgerBalancesRpc()),
  ]);

  const firstError = [
    orderRowsResult,
    linkedJobsResult,
    stockCountResult,
    openOrdersResult,
    totalOrdersResult,
    todayInvoicesResult,
    todayInvoiceCountResult,
    totalInvoicesResult,
  ].find((result) => result.error)?.error;
  if (firstError) {
    return {
      ...emptyHomeDashboardSummary(),
      loadWarning: describeDashboardError(firstError),
    };
  }

  const linkedOrderIds = new Set<string>(
    (linkedJobsResult.data ?? []).map((row: any) => String(row.order_id)).filter(Boolean),
  );
  const orders = (orderRowsResult.data ?? []).map(mapOrderRow);
  const buckets = buildBuckets(orders, linkedOrderIds, today, tomorrow);
  const people = await fetchDashboardPeople(orders).catch(() => [] as HomeDashboardPerson[]);

  const goldBuckets = {
    vault: asNumber(ledgerBalances?.buckets?.vault),
    karigar: asNumber(ledgerBalances?.buckets?.karigar),
    finished: asNumber(ledgerBalances?.buckets?.finished),
    customer: asNumber(ledgerBalances?.buckets?.customer),
    jeweller: asNumber(ledgerBalances?.buckets?.jeweller),
    scrap: asNumber(ledgerBalances?.buckets?.scrap),
  };
  const ledgerTotal = asNumber(ledgerBalances?.ledgerTotal);
  const bucketTotal = asNumber(ledgerBalances?.totalUnderManagement);

  const todayTotals = computeTodayInvoiceTotals(todayInvoicesResult.data ?? []);

  return {
    buckets,
    people,
    goldBuckets,
    ledgerBalanced: ledgerBalances?.balanced ?? ledgerTotal === bucketTotal,
    ledgerDiscrepancyMg: ledgerBalances?.discrepancyMg ?? ledgerTotal - bucketTotal,
    openOrders: openOrdersResult.count ?? orders.length,
    totalOrders: totalOrdersResult.count ?? orders.length,
    stockCount: stockCountResult.count ?? 0,
    todayBillingPaise: todayTotals.billingPaise,
    todayInvoiceCount: todayInvoiceCountResult.count ?? todayInvoicesResult.data?.length ?? 0,
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
      (todayInvoicesResult.data?.length ?? 0) >= HOME_ROW_LIMIT,
    includesOrderBuckets: true,
  };
}

function normalizeExpectedDelivery(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function mapOrderRow(row: any): HomeDashboardOrder {
  const payload = asPayload(row);
  return {
    id: String(row.id),
    orderNo: String(row.order_no ?? payload.orderNo ?? row.id),
    status: String(row.status ?? payload.status ?? ""),
    type: String(row.type ?? payload.type ?? ""),
    expectedDelivery: normalizeExpectedDelivery(row.expected_delivery ?? payload.expectedDelivery),
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
  const { resolveFirmIdForQuery, withFirmScope } = await import("@/lib/firm-scoped-query");
  const firmId = await resolveFirmIdForQuery();
  if (!firmId) return [];
  const { data, error } = await withFirmScope(
    (supabase as any).from("people").select("id,full_name,phone").in("id", ids).limit(HOME_ROW_LIMIT),
    firmId,
  );
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
