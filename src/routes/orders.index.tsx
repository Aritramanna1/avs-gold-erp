import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
  ORDER_TYPE_LABELS,
  type OrderStatus,
  type OrderType,
} from "@/lib/orders-store";
import { usePeople } from "@/lib/people-store";
import { mgToGrams } from "@/lib/gold";
import {
  deliveryBucket,
  customerReminderMessage,
  karigarReminderMessage,
} from "@/lib/orders-tracking";
import { ReminderDialog } from "@/components/reminder-dialog";
import { Plus, Search, ShoppingBag, Eye, Calendar, Send } from "lucide-react";
import { useBranchFilter } from "@/lib/branch-filter";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSettings } from "@/lib/settings-store";

export const Route = createFileRoute("/orders/")({
  head: () => ({ meta: [{ title: "Orders · AVS Gold ERP" }] }),
  component: OrdersListPage,
});

const STATUS_TONE: Partial<Record<OrderStatus, string>> = {
  draft: "bg-muted text-muted-foreground",
  confirmed: "bg-gold/15 text-gold border-gold/30",
  awaiting_job_card: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  in_production: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  ready_billing: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  delivered: "bg-green-600/20 text-green-300 border-green-500/30",
  cancelled: "bg-red-500/15 text-red-300 border-red-500/30",
};

function OrdersListPage() {
  const { t } = useLanguage();
  const orders = useOrders((s) => s.orders);
  const people = usePeople((s) => s.people);
  const { filter: branchFilter, branches, selectedBranchId } = useBranchFilter();

  const [query, setQuery] = useState("");
  const [statusF, setStatusF] = useState<"all" | OrderStatus>("all");
  const [typeF, setTypeF] = useState<"all" | OrderType>("all");
  const [reminder, setReminder] = useState<{ cust: string; kari?: string } | null>(null);

  const customerName = (id: string) => people.find((p) => p.id === id)?.fullName ?? "—";

  const filteredOrders = useMemo(() => branchFilter(orders), [orders, branchFilter]);

  function openReminder(orderId: string) {
    const o = filteredOrders.find((x) => x.id === orderId);
    if (!o) return;
    const cust = people.find((p) => p.id === o.customerId);
    const kari = o.karigarId ? people.find((p) => p.id === o.karigarId) : null;

    const bid = o.branchId || selectedBranchId || "MAIN";
    const branch = branches.find((b) => b.id === bid) || branches[0];
    const bName =
      branch && branch.id !== "MAIN"
        ? `${useSettings.getState().firm.shopName} (${branch.name})`
        : undefined;

    setReminder({
      cust: customerReminderMessage({
        customerName: cust?.fullName ?? "Customer",
        orderNo: o.orderNo,
        itemName: o.item.itemName,
        shopName: bName,
      }),
      kari: kari
        ? karigarReminderMessage({
            karigarName: kari.fullName,
            orderNo: o.orderNo,
            itemName: o.item.itemName,
            deliveryDate: o.expectedDelivery,
          })
        : undefined,
    });
  }

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return filteredOrders.filter((o) => {
      if (statusF !== "all" && o.status !== statusF) return false;
      if (typeF !== "all" && o.type !== typeF) return false;
      if (q) {
        const cust = customerName(o.customerId).toLowerCase();
        const hay = `${o.orderNo} ${cust} ${o.item.itemName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredOrders, people, query, statusF, typeF]);

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

      <div className="rounded-2xl border border-border bg-card p-4 mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("orders.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusF} onValueChange={(v) => setStatusF(v as typeof statusF)}>
          <SelectTrigger className="sm:w-52">
            <SelectValue placeholder={t("orders.statusPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("orders.allStatuses")}</SelectItem>
            {(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {t("orders.status_" + s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeF} onValueChange={(v) => setTypeF(v as typeof typeF)}>
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

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center">
          <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 font-serif text-xl text-gold">{t("orders.noOrdersTitle")}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{t("orders.noOrdersDesc")}</p>
          <Link to="/orders/new" className="inline-block mt-4">
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> {t("orders.createOrder")}
            </Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
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
                {list.map((o) => {
                  const bucket = deliveryBucket(o);
                  return (
                    <tr key={o.id} className="border-t border-border hover:bg-muted/20">
                      <td className="px-4 py-3 font-mono text-xs text-gold">{o.orderNo}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(o.createdAt).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-4 py-3">{customerName(o.customerId)}</td>
                      <td className="px-4 py-3">
                        {o.item.itemName}
                        <div className="text-[11px] text-muted-foreground">{o.item.category}</div>
                      </td>
                      <td className="px-4 py-3 text-xs">{t("orders.type_" + o.type)}</td>
                      <td className="px-4 py-3 font-mono text-xs">{mgToGrams(o.item.fineMg)} g</td>
                      <td className="px-4 py-3 text-xs">
                        {o.expectedDelivery ? (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {o.expectedDelivery}
                            {bucket === "delayed" && (
                              <Badge
                                variant="outline"
                                className="ml-1 bg-red-500/15 text-red-300 border-red-500/30 text-[10px]"
                              >
                                {t("orders.delayed")}
                              </Badge>
                            )}
                            {bucket === "tomorrow" && (
                              <Badge
                                variant="outline"
                                className="ml-1 bg-amber-500/15 text-amber-300 border-amber-500/30 text-[10px]"
                              >
                                {t("orders.tomorrow")}
                              </Badge>
                            )}
                            {bucket === "today" && (
                              <Badge
                                variant="outline"
                                className="ml-1 bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px]"
                              >
                                {t("orders.today")}
                              </Badge>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={STATUS_TONE[o.status]}>
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
        </div>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        {t("orders.workflow")}: <span className="text-gold">Order</span> → Job Card → Issue Gold →
        Receive Work → Stock → Billing → Daily Close.
      </p>

      <ReminderDialog
        open={!!reminder}
        onClose={() => setReminder(null)}
        customerMessage={reminder?.cust ?? ""}
        karigarMessage={reminder?.kari}
      />
    </div>
  );
}
