import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Coins, TrendingUp, TrendingDown, Users, FileText } from "lucide-react";
import { MOBILE_QUICK_ACTIONS } from "@/lib/mobile/mobile-actions-catalog";
import { MobileModulesSheet } from "@/components/mobile/MobileModulesSheet";
import { useSettings } from "@/lib/settings-store";
import { fetchHomeDashboardSummary } from "@/lib/home-dashboard-query";

function mgToKgDisplay(mg: number): string {
  const g = mg / 1000;
  if (g >= 1000) return `${(g / 1000).toFixed(3)} kg`;
  return `${g.toFixed(3)} g`;
}

/** Mobile home — real KPIs from get_home_dashboard_summary (same source as desktop). */
export function MobileHomeDashboard() {
  const firm = useSettings((s) => s.firm);
  const goldRate = useSettings((s) => s.goldRatePerGramPaise);
  const [goldMg, setGoldMg] = useState<number | null>(null);
  const [openOrders, setOpenOrders] = useState<number | null>(null);
  const [todayBillingPaise, setTodayBillingPaise] = useState<number | null>(null);
  const [issuedToday, setIssuedToday] = useState(0);
  const [returnedToday, setReturnedToday] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const summary = await fetchHomeDashboardSummary();
        if (cancelled) return;
        const vault = summary.goldBuckets.vault + summary.goldBuckets.finished;
        setGoldMg(vault || Object.values(summary.goldBuckets).reduce((a, b) => a + b, 0));
        setOpenOrders(summary.openOrders);
        setTodayBillingPaise(summary.todayBillingPaise);
        // Approximate issue/return from karigar bucket magnitude for the day strip;
        // full movement detail remains on Gold Ledger (no fake numbers).
        setIssuedToday(Math.max(0, summary.goldBuckets.karigar));
        setReturnedToday(Math.max(0, summary.todayGoldSoldMg));
      } catch {
        /* home still renders; values stay placeholders */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const today = new Date().toLocaleDateString("en-IN", { dateStyle: "medium" });
  const rateLabel =
    goldRate > 0 ? `₹${(goldRate / 100).toLocaleString("en-IN")}/g` : "Set rate in header";

  return (
    <div className="p-4 pb-24 space-y-5 max-w-lg mx-auto">
      <header>
        <p className="text-sm text-muted-foreground">Good day</p>
        <h1 className="font-serif text-xl">{firm?.shopName ?? "Ornexa"}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Operating date {today} · {rateLabel}
        </p>
      </header>

      <section className="rounded-md border border-gold/30 bg-card p-4">
        <div className="flex items-center gap-2 text-gold mb-2">
          <Coins className="h-4 w-4" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Fine Gold Position</span>
        </div>
        <p className="font-serif text-2xl text-foreground tabular-nums">
          {goldMg != null ? mgToKgDisplay(goldMg) : "—"}
        </p>
        <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Live vault + finished · {today}
        </p>
        <Link to="/ledger" className="mt-3 inline-flex text-xs font-medium text-gold">
          Open Gold Ledger →
        </Link>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <div className="rounded-md border border-border bg-card p-3">
          <TrendingUp className="h-4 w-4 text-primary mb-1" />
          <p className="text-[10px] uppercase text-muted-foreground">Karigar custody</p>
          <p className="text-sm font-semibold tabular-nums">{mgToKgDisplay(issuedToday)}</p>
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          <TrendingDown className="h-4 w-4 text-emerald-600 mb-1" />
          <p className="text-[10px] uppercase text-muted-foreground">Gold sold today</p>
          <p className="text-sm font-semibold tabular-nums">{mgToKgDisplay(returnedToday)}</p>
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          <Users className="h-4 w-4 text-gold mb-1" />
          <p className="text-[10px] uppercase text-muted-foreground">Open orders</p>
          <p className="text-sm font-semibold tabular-nums">
            {openOrders != null ? openOrders : "—"}
          </p>
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          <FileText className="h-4 w-4 text-gold mb-1" />
          <p className="text-[10px] uppercase text-muted-foreground">Today billing</p>
          <p className="text-sm font-semibold tabular-nums">
            {todayBillingPaise != null
              ? `₹${(todayBillingPaise / 100).toLocaleString("en-IN")}`
              : "—"}
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Quick actions
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {MOBILE_QUICK_ACTIONS.slice(0, 6).map((action) => (
            <Link
              key={action.id}
              to={action.to as "/app"}
              search={action.search}
              className="flex flex-col items-start gap-2 min-h-[var(--touch-target)] rounded-md border border-border bg-card p-3 hover:border-gold/30"
            >
              <span className="text-sm font-medium">{action.label}</span>
            </Link>
          ))}
        </div>
        <MobileModulesSheet />
      </section>
    </div>
  );
}
