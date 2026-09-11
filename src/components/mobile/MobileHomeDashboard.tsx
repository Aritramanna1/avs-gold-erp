import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Coins, TrendingUp, TrendingDown, Users, FileText } from "lucide-react";
import { MOBILE_QUICK_ACTIONS } from "@/lib/mobile/mobile-actions-catalog";
import { MobileModulesSheet } from "@/components/mobile/MobileModulesSheet";
import { useSettings } from "@/lib/settings-store";
import {
  fetchHomeDashboardSummary,
  HOME_DASHBOARD_TIMEOUT_MS,
  type HomeDashboardSummary,
} from "@/lib/home-dashboard-query";
import { mgToGrams } from "@/lib/gold";
import { withTimeout } from "@/lib/performance/resilient-async";
import { APP_NAME } from "@/lib/app-info";

export function MobileHomeDashboard() {
  const firm = useSettings((s) => s.firm);
  const goldRate = useSettings((s) => s.goldRatePerGramPaise);
  const [summary, setSummary] = useState<HomeDashboardSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      try {
        const data = await withTimeout(
          fetchHomeDashboardSummary(ac.signal),
          HOME_DASHBOARD_TIMEOUT_MS,
          "mobileHomeDashboard",
          ac.signal,
        );
        if (!ac.signal.aborted) {
          setSummary(data);
          setLoadError(data.loadWarning ?? null);
        }
      } catch (err) {
        if (!ac.signal.aborted) {
          setLoadError(err instanceof Error ? err.message : "Dashboard could not load.");
        }
      }
    })();
    return () => ac.abort();
  }, []);

  const today = new Date().toLocaleDateString("en-IN", { dateStyle: "medium" });
  const vaultMg = summary?.goldBuckets.vault ?? 0;
  const karigarMg = summary?.goldBuckets.karigar ?? 0;

  return (
    <div className="p-4 pb-24 space-y-5 max-w-lg mx-auto">
      <header>
        <p className="text-sm text-muted-foreground">Good day</p>
        <h1 className="font-serif text-xl">{firm?.shopName ?? APP_NAME}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Operating date {today}</p>
      </header>

      {loadError ? (
        <p className="text-xs text-amber-700 border border-amber-500/30 rounded-md p-2">
          {loadError}
        </p>
      ) : null}

      <section className="rounded-md border border-gold/30 bg-card p-4">
        <div className="flex items-center gap-2 text-gold mb-2">
          <Coins className="h-4 w-4" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Fine Gold Position</span>
        </div>
        <p className="font-serif text-2xl text-foreground tabular-nums">
          {summary ? `${mgToGrams(vaultMg)} g` : "—"}
        </p>
        <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {summary?.ledgerBalanced ? "Balanced" : "Check ledger"} · {today}
        </p>
        <Link
          to="/assistant"
          search={{ q: "fine gold position today" }}
          className="mt-3 inline-flex text-xs font-medium text-gold"
        >
          Open Gold Book →
        </Link>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <div className="rounded-md border border-border bg-card p-3">
          <TrendingUp className="h-4 w-4 text-primary mb-1" />
          <p className="text-[10px] uppercase text-muted-foreground">With Karigars</p>
          <p className="text-sm font-semibold tabular-nums">
            {summary ? mgToGrams(karigarMg) : "—"}
          </p>
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          <TrendingDown className="h-4 w-4 text-emerald-600 mb-1" />
          <p className="text-[10px] uppercase text-muted-foreground">Finished Stock</p>
          <p className="text-sm font-semibold tabular-nums">
            {summary ? mgToGrams(summary.goldBuckets.finished ?? 0) : "—"}
          </p>
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          <Users className="h-4 w-4 text-gold mb-1" />
          <p className="text-[10px] uppercase text-muted-foreground">22K Rate</p>
          <p className="text-sm font-semibold">
            {goldRate > 0 ? `₹${(goldRate / 100).toLocaleString("en-IN")}/g` : "Not set"}
          </p>
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          <FileText className="h-4 w-4 text-muted-foreground mb-1" />
          <p className="text-[10px] uppercase text-muted-foreground">Open Orders</p>
          <p className="text-sm font-semibold">{summary?.openOrders ?? "—"}</p>
        </div>
      </section>

      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Quick actions
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {MOBILE_QUICK_ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.id}
                to={a.to}
                search={a.search}
                className="flex flex-col items-start gap-2 min-h-[var(--touch-target)] rounded-md border border-border bg-card p-3 hover:border-gold/30"
              >
                <Icon className="h-4 w-4 text-gold" />
                <span className="text-xs font-semibold leading-tight">{a.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Full ERP
        </h2>
        <MobileModulesSheet />
      </section>
    </div>
  );
}
