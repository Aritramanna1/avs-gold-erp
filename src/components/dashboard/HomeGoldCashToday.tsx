import { Coins, Banknote } from "lucide-react";
import { mgToGrams } from "@/lib/gold";
import type { HomeDashboardSummary } from "@/lib/home-dashboard-query";

function formatInr(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

function formatFineG(mg: number): string {
  return `${mgToGrams(mg)} g @995`;
}

interface HomeGoldCashTodayProps {
  summary: HomeDashboardSummary | null;
}

/**
 * AVS-32 MVP-HOME / AVS-4: GOLD TODAY before CASH TODAY — never one collapsed ₹ total.
 * Uses existing home-dashboard summary fields only (no invented rates).
 */
export function HomeGoldCashToday({ summary }: HomeGoldCashTodayProps) {
  const soldMg = summary?.todayGoldSoldMg ?? 0;
  const stockMg = summary?.goldBuckets.vault ?? 0;
  const karigarMg = summary?.goldBuckets.karigar ?? 0;
  const salesPaise = summary?.todayBillingPaise ?? 0;
  const inPaise =
    (summary?.todayCashPaise ?? 0) +
    (summary?.todayUpiPaise ?? 0) +
    (summary?.todayCardPaise ?? 0);
  const outPaise = summary?.todayGoldPaidPaise ?? 0;
  const outstandingPaise = summary?.todayOutstandingPaise ?? 0;

  return (
    <section
      className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-3"
      aria-label="Today gold and cash"
      data-tour="home-gold-cash-today"
    >
      <div className="rounded-md border border-gold/40 bg-gold/5 p-4 min-h-[var(--touch-target)]">
        <div className="flex items-center gap-2 text-gold mb-3">
          <Coins className="h-4 w-4 shrink-0" aria-hidden />
          <h2 className="text-xs font-bold uppercase tracking-wider">Gold today</h2>
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <div>
            <dt className="text-[10px] uppercase text-muted-foreground">Sold</dt>
            <dd className="font-serif tabular-nums font-semibold">{formatFineG(soldMg)}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-muted-foreground">Stock</dt>
            <dd className="font-serif tabular-nums font-semibold">{formatFineG(stockMg)}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-muted-foreground">With karigar</dt>
            <dd className="font-serif tabular-nums">{formatFineG(karigarMg)}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-muted-foreground">Bills</dt>
            <dd className="tabular-nums">{summary?.todayInvoiceCount ?? 0}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-md border border-border bg-card p-4 min-h-[var(--touch-target)]">
        <div className="flex items-center gap-2 text-foreground mb-3">
          <Banknote className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <h2 className="text-xs font-bold uppercase tracking-wider">Cash today</h2>
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <div>
            <dt className="text-[10px] uppercase text-muted-foreground">Sales</dt>
            <dd className="font-semibold tabular-nums">{formatInr(salesPaise)}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-muted-foreground">In</dt>
            <dd className="tabular-nums">{formatInr(inPaise)}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-muted-foreground">Out (gold paid ₹)</dt>
            <dd className="tabular-nums">{formatInr(outPaise)}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-muted-foreground">Outstanding</dt>
            <dd className="tabular-nums">{formatInr(outstandingPaise)}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
