import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useOrders,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_FLOW,
  ORDER_TYPE_LABELS,
  orderItems,
  orderTotals,
  productionTypeLabel,
  type Order,
  type OrderStatus,
  type OrderType,
} from "@/lib/orders-store";
import { fetchOrdersPage } from "@/lib/orders-query";
import { renderOrderTemplate } from "@/lib/order-messages";
import { usePeople } from "@/lib/people-store";
import { useJobCards } from "@/lib/jobcards-store";
import { mgToGrams } from "@/lib/gold";
import { deliveryBucket } from "@/lib/orders-tracking";
import { ReminderDialog } from "@/components/reminder-dialog";
import { Plus, Search, ShoppingBag, Eye, Calendar, Send } from "lucide-react";
import { useBranchFilter } from "@/lib/branch-filter";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSettings } from "@/lib/settings-store";
import { EmptyState, WebAppState } from "@/components/web-app-state";

type OrdersSearch = {
  q?: string;
  status?: "all" | OrderStatus;
  type?: "all" | OrderType;
  page?: number;
};

export const Route = createFileRoute("/orders/")({
  head: () => ({ meta: [{ title: "Orders · AVS Gold ERP" }] }),
  validateSearch: (search: Record<string, unknown>): OrdersSearch => ({
    q: typeof search.q === "string" ? search.q : "",
    status: typeof search.status === "string" ? (search.status as OrdersSearch["status"]) : "all",
    type: typeof search.type === "string" ? (search.type as OrdersSearch["type"]) : "all",
    page:
      typeof search.page === "number"
        ? search.page
        : typeof search.page === "string"
          ? Number(search.page)
          : 1,
  }),
  component: OrdersListPage,
});

/**
 * Status colours.
 *
 * The old tones were 15%-opacity fills with 300-weight text — on the dark
 * theme they read as five shades of grey, and a shop-floor screen is scanned
 * from a metre away, not studied. These are solid fills with high-contrast
 * text, and they group by MEANING, so a glance down the column separates
 * "needs someone to act" from "moving on its own" from "finished":
 *   grey   = not started / dead      (draft, cancelled)
 *   blue   = waiting on us to act    (confirmed, awaiting job card)
 *   amber  = work in progress        (in production, gold issued…)
 *   violet = partially done
 *   green  = done / ready            (ready for billing, ready, delivered)
 * Anything unmapped falls back to a neutral, always-legible tone rather than
 * an invisible badge.
 */
const STATUS_TONE: Partial<Record<OrderStatus, string>> = {
  draft: "bg-slate-500/25 text-slate-100 border-slate-400/40",
  cancelled: "bg-red-600 text-white border-red-500",

  confirmed: "bg-blue-600 text-white border-blue-500",
  awaiting_job_card: "bg-blue-500/90 text-white border-blue-400",

  in_production: "bg-amber-500 text-black border-amber-400",
  in_manufacturing: "bg-amber-500 text-black border-amber-400",
  gold_issued: "bg-amber-600 text-white border-amber-500",
  gold_received: "bg-amber-600 text-white border-amber-500",
  sent_to_worker: "bg-amber-600 text-white border-amber-500",
  repair_in_progress: "bg-amber-600 text-white border-amber-500",
  polishing_in_progress: "bg-amber-600 text-white border-amber-500",
  sent_for_polishing: "bg-amber-600 text-white border-amber-500",
  under_inspection: "bg-orange-500 text-black border-orange-400",
  received: "bg-orange-500 text-black border-orange-400",

  partially_ready: "bg-violet-600 text-white border-violet-500",
  partially_delivered: "bg-violet-600 text-white border-violet-500",

  ready: "bg-emerald-600 text-white border-emerald-500",
  ready_billing: "bg-emerald-600 text-white border-emerald-500",
  ready_for_delivery: "bg-emerald-600 text-white border-emerald-500",
  billed: "bg-teal-600 text-white border-teal-500",
  delivered: "bg-green-700 text-white border-green-600",
};

const STATUS_TONE_FALLBACK = "bg-slate-600 text-white border-slate-500";

/** Delivery urgency — the one thing on this screen that should shout. */
const BUCKET_TONE: Record<string, string> = {
  delayed: "bg-red-600 text-white border-red-500 font-semibold",
  today: "bg-emerald-600 text-white border-emerald-500 font-semibold",
  tomorrow: "bg-amber-500 text-black border-amber-400 font-semibold",
};

function OrdersListPage() {
  const { t } = useLanguage();
  const people = usePeople((s) => s.people);
  const jobs = useJobCards((s) => s.jobs);
  const { filter: branchFilter } = useBranchFilter();
  const navigate = useNavigate({ from: "/orders" });
  const search = useSearch({ from: "/orders/" });
  const currentUserRole = useSettings((s) => s.currentUserRole);
  const selectedBranchId = useSettings((s) => s.selectedBranchId);
  const [pageOrders, setPageOrders] = useState<Order[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [reminder, setReminder] = useState<{
    cust: string;
    kari?: string;
    custPhone?: string;
    kariPhone?: string;
  } | null>(null);

  const pageSize = 25;
  const page = Math.max(1, Number(search.page) || 1);
  const query = search.q?.trim() ?? "";
  const statusF = search.status ?? "all";
  const typeF = search.type ?? "all";
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const ordersBranchId = useMemo(() => {
    const globalRoles = [
      "Super Owner",
      "Administrator",
      "CEO (View Only)",
      "owner",
      "admin",
      "saas_admin",
    ];
    return currentUserRole && !globalRoles.includes(currentUserRole)
      ? selectedBranchId || "MAIN"
      : null;
  }, [currentUserRole, selectedBranchId]);

  const customerName = (id: string) => people.find((p) => p.id === id)?.fullName ?? "—";

  useEffect(() => {
    let cancelled = false;
    setLoadingOrders(true);
    setOrdersError(null);

    fetchOrdersPage({
      page,
      pageSize,
      query,
      status: statusF,
      type: typeF,
      branchId: ordersBranchId,
    })
      .then((result) => {
        if (cancelled) return;
        setPageOrders(branchFilter(result.orders));
        setTotalCount(result.totalCount);
      })
      .catch((err) => {
        if (cancelled) return;
        setOrdersError(err instanceof Error ? err.message : "Could not load orders.");
        setPageOrders([]);
        setTotalCount(0);
      })
      .finally(() => {
        if (!cancelled) setLoadingOrders(false);
      });

    return () => {
      cancelled = true;
    };
  }, [branchFilter, ordersBranchId, page, query, statusF, typeF]);

  const updateSearch = (patch: Partial<OrdersSearch>) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        ...patch,
        page: patch.page ?? 1,
      }),
      replace: true,
    });
  };

  function openReminder(orderId: string) {
    const o = pageOrders.find((x) => x.id === orderId);
    if (!o) return;
    const cust = people.find((p) => p.id === o.customerId);
    // Who to chase for this order: whoever has one of its pieces on their bench.
    // That's on the JOB CARDS now, not the order — an order carries no karigar
    // until its work is assigned. Falls back to `order.karigarId` for legacy /
    // imported orders that still carry one.
    const jobKarigarId =
      jobs.find((j) => j.orderId === o.id && j.karigarId)?.karigarId ?? o.karigarId;
    const kari = jobKarigarId ? people.find((p) => p.id === jobKarigarId) : null;

    // Both messages are rendered from the templates the workshop edits in
    // Settings → WhatsApp Templates, not from strings in the code. Placeholders
    // (customer, order number, every item, delivery date) are filled from the
    // live order by buildContext.
    setReminder({
      cust: renderOrderTemplate("delay_update", o),
      custPhone: cust?.phone,
      kari: kari ? renderOrderTemplate("work_reminder", o) : undefined,
      kariPhone: kari?.phone,
    });
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title={t("orders.title")}
        subtitle={t("orders.subtitle")}
        actions={
          <Link to="/orders/new">
            <Button data-testid="order-new" className="gap-2">
              <Plus className="h-4 w-4" /> {t("orders.createOrder")}
            </Button>
          </Link>
        }
      />

      <div className="rounded-md border border-border bg-card p-4 mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("orders.searchPlaceholder")}
            value={query}
            onChange={(e) => updateSearch({ q: e.target.value })}
            className="pl-9"
          />
        </div>
        <Select
          value={statusF}
          onValueChange={(v) => updateSearch({ status: v as typeof statusF })}
        >
          <SelectTrigger className="sm:w-52">
            <SelectValue placeholder={t("orders.statusPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("orders.allStatuses")}</SelectItem>
            {ORDER_STATUS_FLOW.map((s) => (
              <SelectItem key={s} value={s}>
                {t("orders.status_" + s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeF} onValueChange={(v) => updateSearch({ type: v as typeof typeF })}>
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder={t("orders.orderTypePlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("orders.allTypes")}</SelectItem>
            {(Object.keys(ORDER_TYPE_LABELS) as OrderType[]).map((tKey) => (
              <SelectItem key={tKey} value={tKey}>
                {t("orders.type_" + tKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loadingOrders ? (
        <WebAppState
          title="Loading orders"
          description="Fetching the order register from Supabase."
        />
      ) : ordersError ? (
        <WebAppState
          title="Could not load orders"
          description={ordersError}
          tone="danger"
          action={{ label: "Retry", onClick: () => updateSearch({ page }) }}
        />
      ) : pageOrders.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-card/40 p-12 text-center">
          {query || statusF !== "all" || typeF !== "all" ? (
            <EmptyState
              title="No orders match this view"
              description="Clear or adjust the search and filters to see other orders."
            />
          ) : (
            <>
              <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="mt-4 font-serif text-xl text-gold">{t("orders.noOrdersTitle")}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t("orders.noOrdersDesc")}</p>
            </>
          )}
          <Link to="/orders/new" className="inline-block mt-4">
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> {t("orders.createOrder")}
            </Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-md border border-border bg-card overflow-hidden">
          {/* ── Mobile card view ── */}
          <div className="block md:hidden divide-y divide-border">
            {pageOrders.map((o) => {
              const bucket = deliveryBucket(o);
              const items = orderItems(o);
              return (
                <Link
                  key={o.id}
                  to="/orders/$id"
                  params={{ id: o.id }}
                  className="block p-3 hover:bg-muted/20 active:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-gold">{o.orderNo}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${STATUS_TONE[o.status] ?? STATUS_TONE_FALLBACK}`}
                        >
                          {t("orders.status_" + o.status)}
                        </Badge>
                      </div>
                      <div className="text-sm mt-1 truncate">{customerName(o.customerId)}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {items[0]?.itemName ?? "—"}
                        {items.length > 1 ? ` · +${items.length - 1} more` : ""}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-xs">{mgToGrams(orderTotals(o).fineMg)} g</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(o.createdAt).toLocaleDateString("en-IN")}
                      </div>
                    </div>
                  </div>
                  {o.expectedDelivery && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {o.expectedDelivery}
                      {(bucket === "delayed" || bucket === "today" || bucket === "tomorrow") && (
                        <Badge variant="outline" className={`text-[10px] ${BUCKET_TONE[bucket]}`}>
                          {t("orders." + bucket)}
                        </Badge>
                      )}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>

          {/* ── Desktop table view ── */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">{t("orders.orderNoCol")}</th>
                  <th className="text-left px-4 py-3 font-medium">{t("orders.dateCol")}</th>
                  <th className="text-left px-4 py-3 font-medium">{t("orders.customerCol")}</th>
                  <th className="text-left px-4 py-3 font-medium">{t("orders.itemCol")}</th>
                  <th className="text-left px-4 py-3 font-medium">{t("orders.typeCol")}</th>
                  <th className="text-left px-4 py-3 font-medium">{t("orders.fineGoldCol")}</th>
                  <th className="text-left px-4 py-3 font-medium">{t("orders.deliveryCol")}</th>
                  <th className="text-left px-4 py-3 font-medium">{t("orders.statusCol")}</th>
                  <th className="text-right px-4 py-3 font-medium">{t("orders.actionCol")}</th>
                </tr>
              </thead>
              <tbody>
                {pageOrders.map((o) => {
                  const bucket = deliveryBucket(o);
                  return (
                    <tr key={o.id} className="border-t border-border hover:bg-muted/20">
                      <td className="px-4 py-3 font-mono text-xs text-gold">{o.orderNo}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(o.createdAt).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-4 py-3">{customerName(o.customerId)}</td>
                      <td className="px-4 py-3">
                        {orderItems(o)[0]?.itemName ?? "—"}
                        <div className="text-[11px] text-muted-foreground">
                          {orderItems(o).length > 1
                            ? `${orderItems(o)[0]?.category} · +${orderItems(o).length - 1} more item${orderItems(o).length > 2 ? "s" : ""}`
                            : orderItems(o)[0]?.category}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs">{productionTypeLabel(o)}</td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {mgToGrams(orderTotals(o).fineMg)} g
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {o.expectedDelivery ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="h-3 w-3" />
                            {o.expectedDelivery}
                            {(bucket === "delayed" ||
                              bucket === "today" ||
                              bucket === "tomorrow") && (
                              <Badge
                                variant="outline"
                                className={`ml-1 text-[10px] uppercase tracking-wide ${BUCKET_TONE[bucket]}`}
                              >
                                {t("orders." + bucket)}
                              </Badge>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={`whitespace-nowrap font-medium ${STATUS_TONE[o.status] ?? STATUS_TONE_FALLBACK}`}
                        >
                          {t("orders.status_" + o.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {(bucket === "delayed" ||
                            bucket === "tomorrow" ||
                            bucket === "today") && (
                            <button
                              onClick={() => openReminder(o.id)}
                              className="inline-flex items-center gap-1 text-amber-300 hover:underline text-xs"
                              title="Prepare reminder message"
                            >
                              <Send className="h-3 w-3" /> {t("orders.remind")}
                            </button>
                          )}
                          <Link
                            to="/orders/$id"
                            params={{ id: o.id }}
                            className="inline-flex items-center gap-1 text-gold hover:underline text-xs"
                          >
                            <Eye className="h-3 w-3" /> {t("orders.view")}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <span>
              Page {page} of {totalPages} · {totalCount} orders
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1 || loadingOrders}
                onClick={() => updateSearch({ page: Math.max(1, page - 1) })}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loadingOrders}
                onClick={() => updateSearch({ page: page + 1 })}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        {t("orders.workflow")}: <span className="text-gold">Order</span> → Job Card → Receive Work →
        Stock → Billing → Daily Close.
      </p>

      <ReminderDialog
        open={!!reminder}
        onClose={() => setReminder(null)}
        customerMessage={reminder?.cust ?? ""}
        karigarMessage={reminder?.kari}
        customerPhone={reminder?.custPhone}
        karigarPhone={reminder?.kariPhone}
      />
    </div>
  );
}
