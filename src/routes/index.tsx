import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { useSettings } from "@/lib/settings-store";
import { useCurrentGoldRatePaise } from "@/lib/bullion-rate-service";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useOrders, ORDER_STATUS_LABELS } from "@/lib/orders-store";
import { useJobCards } from "@/lib/jobcards-store";
import { useLedger, computeBalances } from "@/lib/ledger-store";
import { useStock } from "@/lib/stock-store";
import { useBilling } from "@/lib/billing-store";
import { usePeople } from "@/lib/people-store";
import { mgToGrams } from "@/lib/gold";
import {
  computeOrderBuckets,
  customerReminderMessage,
  karigarReminderMessage,
} from "@/lib/orders-tracking";
import { ReminderDialog } from "@/components/reminder-dialog";
import {
  Scale,
  Hammer,
  Package,
  Users,
  ShoppingBag,
  Receipt,
  AlertTriangle,
  Clock,
  CalendarCheck,
  ClipboardList,
  MessageCircle,
  TrendingDown,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Home · AVS Gold ERP" },
      { name: "description", content: "Daily operations overview." },
    ],
  }),
  component: Home,
});

function Home() {
  const { t } = useLanguage();
  const { firm, settingsHydrated } = useSettings();
  const goldRatePerGramPaise = useCurrentGoldRatePaise();
  const navigate = useNavigate();

  // First-run gate: once settings have actually finished loading (not the
  // pre-hydration window every page load briefly passes through), an empty
  // shopName means this is a genuinely fresh install — send it straight to
  // setup instead of showing an empty dashboard with a dismissible banner.
  useEffect(() => {
    if (settingsHydrated && !firm.shopName) {
      navigate({ to: "/setup", replace: true });
    }
  }, [settingsHydrated, firm.shopName, navigate]);

  const orders = useOrders((s) => s.orders) ?? [];
  const jobs = useJobCards((s) => s.jobs) ?? [];
  const ledger = useLedger((s) => s.entries) ?? [];
  const stock = useStock((s) => s.items) ?? [];
  const invoices = useBilling((s) => s.invoices) ?? [];
  const people = usePeople((s) => s.people) ?? [];

  const balance = useMemo(() => computeBalances(ledger ?? []), [ledger]);
  const linkedJobOrderIds = useMemo(
    () => new Set((jobs ?? []).map((j) => j?.orderId).filter(Boolean) as string[]),
    [jobs],
  );
  const buckets = useMemo(() => {
    const fallback = { today: [], tomorrow: [], delayed: [], pendingJobCard: [], readyBilling: [] };
    try {
      return computeOrderBuckets(orders ?? [], linkedJobOrderIds) ?? fallback;
    } catch {
      return fallback;
    }
  }, [orders, linkedJobOrderIds]);

  const todayInvoices = (invoices ?? []).filter((i) => {
    if (!i?.createdAt) return false;
    return new Date(i.createdAt).toDateString() === new Date().toDateString();
  });

  const todayBill = todayInvoices.reduce((s, i) => s + (i?.grandTotalPaise ?? 0), 0);

  const todayCash = todayInvoices.reduce(
    (s, i) =>
      s + i.payments.filter((p) => p.mode === "cash").reduce((a, p) => a + p.amountPaise, 0),
    0,
  );
  const todayUpi = todayInvoices.reduce(
    (s, i) => s + i.payments.filter((p) => p.mode === "upi").reduce((a, p) => a + p.amountPaise, 0),
    0,
  );
  const todayCard = todayInvoices.reduce(
    (s, i) =>
      s + i.payments.filter((p) => p.mode === "card").reduce((a, p) => a + p.amountPaise, 0),
    0,
  );
  const todayGoldPaid = todayInvoices.reduce(
    (s, i) =>
      s +
      i.payments
        .filter((p) => p.mode === "gold_exchange" || p.mode === "customer_gold_credit")
        .reduce((a, p) => a + p.amountPaise, 0),
    0,
  );
  const todayOutstanding = todayInvoices.reduce((s, i) => s + Math.max(0, i.balancePaise ?? 0), 0);
  const todayGoldSoldMg = todayInvoices.reduce(
    (s, i) => s + i.items.reduce((a, it) => a + (it.fineMg ?? 0), 0),
    0,
  );

  const customerGold = balance?.buckets?.customer ?? 0;
  const karigarGold = balance?.buckets?.karigar ?? 0;
  const finishedGold = balance?.buckets?.finished ?? 0;
  const openOrders = (orders ?? []).filter(
    (o) => o?.status !== "delivered" && o?.status !== "cancelled",
  ).length;
  const stockCount = (stock ?? []).filter((s) => s?.status === "available").length;

  const [reminder, setReminder] = useState<{
    cust: string;
    kari?: string;
    custPhone?: string;
    kariPhone?: string;
  } | null>(null);

  function openReminder(orderId: string) {
    const o = orders.find((x) => x.id === orderId);
    if (!o) return;
    const cust = people.find((p) => p.id === o.customerId);
    // Karigar from the order, or from the job card assigned to it.
    const jobKarigarId = jobs.find((j) => j.orderId === o.id && j.karigarId)?.karigarId;
    const kari = people.find((p) => p.id === (o.karigarId ?? jobKarigarId)) ?? null;
    setReminder({
      custPhone: cust?.phone,
      kariPhone: kari?.phone,
      cust: customerReminderMessage({
        customerName: cust?.fullName ?? "Customer",
        orderNo: o.orderNo,
        itemName: o.item?.itemName ?? "",
      }),
      kari: kari
        ? karigarReminderMessage({
            karigarName: kari.fullName,
            orderNo: o.orderNo,
            itemName: o.item?.itemName ?? "",
            deliveryDate: o.expectedDelivery,
          })
        : undefined,
    });
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <PageHeader title={t("dashboard.goodDay")} subtitle={t("dashboard.overview")} />

      {!firm.shopName && (
        <div className="mb-6 p-4 rounded-xl border border-gold/40 bg-gold/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-serif text-sm text-gold">
              Welcome — finish setting up your business
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Business name, GST, address, and your first branch aren't configured yet.
            </p>
          </div>
          <Link to="/setup">
            <Button size="sm" className="bg-gold hover:bg-gold/90 text-black shrink-0 font-medium">
              Run First-Time Setup
            </Button>
          </Link>
        </div>
      )}

      {goldRatePerGramPaise === 0 && (
        <div className="mb-6 p-4 rounded-xl border border-red-500 bg-red-50 dark:bg-red-950/20 text-red-900 dark:text-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-pulse shadow-md">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm">Gold Rate Not Set</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                The live gold rate is currently missing. Money values, karigar salary calculations,
                and invoices will display as blank or zero until set.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white shrink-0 font-medium"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("open-gold-rate-editor"));
              }
            }}
          >
            Set Gold Rate Now
          </Button>
        </div>
      )}

      {/* Order Tracking Buckets */}
      <h2 className="font-serif text-xl text-gold mb-3">{t("dashboard.orderTracking")}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-6">
        <BucketCard
          icon={CalendarCheck}
          tone="emerald"
          label={t("dashboard.todayDeliveries")}
          count={buckets?.today?.length ?? 0}
          orders={buckets?.today?.slice(0, 3) ?? []}
          onReminder={openReminder}
        />
        <BucketCard
          icon={Clock}
          tone="amber"
          label={t("dashboard.dueTomorrow")}
          count={buckets?.tomorrow?.length ?? 0}
          orders={buckets?.tomorrow?.slice(0, 3) ?? []}
          onReminder={openReminder}
        />
        <BucketCard
          icon={AlertTriangle}
          tone="red"
          label={t("dashboard.delayed")}
          count={buckets?.delayed?.length ?? 0}
          orders={buckets?.delayed?.slice(0, 3) ?? []}
          onReminder={openReminder}
        />
        <BucketCard
          icon={ClipboardList}
          tone="blue"
          label={t("dashboard.pendingJobCard")}
          count={buckets?.pendingJobCard?.length ?? 0}
          orders={buckets?.pendingJobCard?.slice(0, 3) ?? []}
          onReminder={openReminder}
        />
        <BucketCard
          icon={Receipt}
          tone="gold"
          label={t("dashboard.readyForBilling")}
          count={buckets?.readyBilling?.length ?? 0}
          orders={buckets?.readyBilling?.slice(0, 3) ?? []}
        />
      </div>

      <h2 className="font-serif text-xl text-gold mb-3">{t("dashboard.todaySnapshot")}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Tile
          to="/ledger"
          icon={Scale}
          label={t("dashboard.vaultGold")}
          value={`${mgToGrams(balance.buckets.vault)} g`}
          hint={balance.balanced ? "Balanced" : `Difference ${mgToGrams(balance.discrepancyMg)} g`}
        />
        <Tile
          to="/workshop"
          icon={Hammer}
          label={t("dashboard.goldWithKarigars")}
          value={`${mgToGrams(karigarGold)} g`}
          hint="In custody"
        />
        <Tile
          to="/stock"
          icon={Package}
          label={t("dashboard.finishedStock")}
          value={`${mgToGrams(finishedGold)} g`}
          hint={`${stockCount} in stock`}
        />
        <Tile
          to="/people"
          icon={Users}
          label={t("dashboard.customerGoldHeld")}
          value={`${mgToGrams(customerGold)} g`}
          hint="Old gold / advance"
        />
        <Tile
          to="/orders"
          icon={ShoppingBag}
          label={t("dashboard.openOrders")}
          value={String(openOrders)}
          hint={`${orders.length} total`}
        />
        <Tile
          to="/billing"
          icon={Receipt}
          label={t("dashboard.todayBilling")}
          value={`₹ ${(todayBill / 100).toLocaleString("en-IN")}`}
          hint={`${todayInvoices.length} bills today · ${invoices.length} total`}
        />
      </div>

      {/* Today's payment breakdown */}
      {todayInvoices.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { label: "Cash", value: todayCash, color: "text-emerald-500" },
            { label: "UPI", value: todayUpi, color: "text-blue-500" },
            { label: "Card", value: todayCard, color: "text-purple-500" },
            { label: "Gold Paid", value: todayGoldPaid, color: "text-gold" },
            { label: "Outstanding", value: todayOutstanding, color: "text-rose-500" },
            { label: "Gold Sold", value: -1, goldGrams: todayGoldSoldMg, color: "text-amber-500" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-border bg-card p-3 text-center"
            >
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                {item.label}
              </div>
              <div className={`font-mono font-bold text-sm ${item.color}`}>
                {item.value === -1
                  ? `${mgToGrams(item.goldGrams ?? 0)} g`
                  : `₹ ${((item.value ?? 0) / 100).toLocaleString("en-IN")}`}
              </div>
            </div>
          ))}
        </div>
      )}

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

function Tile({
  to,
  icon: Icon,
  label,
  value,
  hint,
}: {
  to: string;
  icon: typeof Scale;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Link
      to={to}
      className="group rounded-2xl border border-border bg-card p-5 shadow-elegant hover:border-gold/40 hover:shadow-gold transition-all"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="font-serif text-3xl text-gold mt-2">{value}</div>
        </div>
        <div className="h-10 w-10 rounded-xl bg-accent/60 grid place-items-center group-hover:bg-gold/10 transition-colors">
          <Icon className="h-5 w-5 text-gold" />
        </div>
      </div>
      <div className="mt-4 text-[11px] text-muted-foreground">{hint}</div>
    </Link>
  );
}

const TONE: Record<string, string> = {
  emerald: "border-emerald-500/30 bg-emerald-500/5",
  amber: "border-amber-500/30 bg-amber-500/5",
  red: "border-red-500/30 bg-red-500/5",
  blue: "border-blue-500/30 bg-blue-500/5",
  gold: "border-gold/30 bg-gold/5",
};

function BucketCard({
  icon: Icon,
  tone,
  label,
  count,
  orders,
  onReminder,
}: {
  icon: typeof Scale;
  tone: keyof typeof TONE;
  label: string;
  count: number;
  orders: {
    id: string;
    orderNo: string;
    item?: { itemName?: string };
    expectedDelivery?: string;
  }[];
  onReminder?: (id: string) => void;
}) {
  return (
    <Card className={`p-4 ${TONE[tone]}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Icon className="h-4 w-4" /> {label}
        </div>
        <Badge variant="outline">{count}</Badge>
      </div>
      {(orders ?? []).length === 0 ? (
        <div className="text-xs text-muted-foreground">None</div>
      ) : (
        <ul className="text-xs space-y-1">
          {(orders ?? []).map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-2">
              <Link to="/orders/$id" params={{ id: o.id }} className="truncate hover:text-gold">
                <span className="font-mono">{o.orderNo}</span> ·{" "}
                {o.item?.itemName ?? "No Item Name"}
              </Link>
              {onReminder && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[#25D366] hover:bg-[#25D366]/10 shrink-0"
                  onClick={() => onReminder(o.id)}
                  title="Send WhatsApp reminder (Customer / Karigar)"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
