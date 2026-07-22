import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLedger, computeBalances } from "@/lib/ledger-store";
import { useBilling } from "@/lib/billing-store";
import { usePeople } from "@/lib/people-store";
import { useWorkerGoldBook } from "@/lib/worker-gold-book-store";
import { formatWeight } from "@/lib/gold";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  IndianRupee,
  Package,
  Scale,
  Users,
} from "lucide-react";

function today(ts: number) {
  return new Date(ts).toDateString() === new Date().toDateString();
}

function Metric({
  label,
  value,
  hint,
  icon: Icon,
  to,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Scale;
  to: string;
}) {
  return (
    <Link
      to={to as never}
      className="group rounded-2xl border border-border bg-card p-5 hover:border-gold/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-2 font-serif text-2xl text-gold">{value}</div>
          {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
        </div>
        <Icon className="h-5 w-5 text-gold/70 group-hover:text-gold" />
      </div>
    </Link>
  );
}

export function WorkshopDashboard() {
  const entries = useLedger((s) => s.entries);
  const invoices = useBilling((s) => s.invoices);
  const people = usePeople((s) => s.people);
  const workerEntries = useWorkerGoldBook((s) => s.entries);

  const balance = useMemo(() => computeBalances(entries), [entries]);
  const openingFine = useMemo(
    () =>
      entries.filter((e) => e.type === "opening_vault").reduce((sum, e) => sum + e.netFineMg, 0),
    [entries],
  );
  const todayIssue = useMemo(
    () =>
      entries
        .filter(
          (e) =>
            today(e.createdAt) &&
            ["issue_to_karigar", "sent_to_polisher", "gold_overdraft_issue"].includes(e.type),
        )
        .reduce((sum, e) => sum + Math.abs(e.netFineMg), 0),
    [entries],
  );
  const todayReturn = useMemo(
    () =>
      entries
        .filter(
          (e) =>
            today(e.createdAt) &&
            [
              "receive_from_karigar",
              "received_from_polisher",
              "scrap_returned",
              "dust_returned",
              "worker_wastage_gold_return",
            ].includes(e.type),
        )
        .reduce((sum, e) => sum + Math.abs(e.netFineMg), 0),
    [entries],
  );
  const profitLossPaise = invoices.reduce((sum, i) => sum + (i.grandTotalPaise || 0), 0);
  const openWorkerBalances = useMemo(() => {
    const workerIds = new Set(
      people
        .filter((p) => ["worker", "karigar", "outside_worker", "employee"].includes(p.type))
        .map((p) => p.id),
    );
    return [...workerIds].filter((id) => {
      const total = workerEntries
        .filter((e) => e.workerId === id)
        .reduce((sum, e) => sum + (e.type === "given" ? e.fineMg : -e.fineMg), 0);
      return total > 0;
    }).length;
  }, [people, workerEntries]);

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8 space-y-6">
      <PageHeader
        title="Workshop Dashboard"
        subtitle="Fine gold position and daily workshop control."
      />

      <div className="rounded-2xl border border-gold/30 bg-gold/5 p-5">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gold">
          <Scale className="h-4 w-4" /> Fine Gold Position
        </div>
        <div className="mt-2 flex flex-wrap items-end gap-x-8 gap-y-2">
          <div>
            <div className="text-xs text-muted-foreground">Current Fine Gold</div>
            <div className="font-serif text-4xl text-gold">
              {formatWeight(balance.totalUnderManagement)}
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Opening: <span className="font-mono text-foreground">{formatWeight(openingFine)}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {balance.balanced
              ? "Ledger reconciled"
              : `Difference ${formatWeight(balance.discrepancyMg)}`}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Metric
          label="Gold in Stock"
          value={formatWeight(balance.buckets.vault)}
          icon={Package}
          to="/ledger"
        />
        <Metric
          label="Gold with Workers"
          value={formatWeight(balance.buckets.karigar)}
          icon={Users}
          to="/workshop/gold-book"
        />
        <Metric
          label="Gold with Jewellers"
          value={formatWeight(balance.buckets.jeweller)}
          icon={BookOpen}
          to="/workshop"
        />
        <Metric
          label="Gold in Scrap / Recovery"
          value={formatWeight(balance.buckets.scrap)}
          icon={Scale}
          to="/ledger"
        />
        <Metric
          label="Profit / Loss"
          value={`₹${(profitLossPaise / 100).toLocaleString("en-IN")}`}
          icon={IndianRupee}
          to="/billing"
        />
        <Metric
          label="Open Worker Balances"
          value={String(openWorkerBalances)}
          icon={Users}
          to="/workshop/gold-book"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-gold">Today’s Gold Movement</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Link
            to="/ledger"
            className="flex items-center gap-3 rounded-xl border border-border p-4 hover:border-gold/40"
          >
            <ArrowUpFromLine className="h-5 w-5 text-amber-400" />
            <div>
              <div className="text-xs text-muted-foreground">Gold Issued</div>
              <div className="font-mono text-lg">{formatWeight(todayIssue)}</div>
            </div>
            <Badge variant="outline" className="ml-auto">
              Today
            </Badge>
          </Link>
          <Link
            to="/ledger"
            className="flex items-center gap-3 rounded-xl border border-border p-4 hover:border-gold/40"
          >
            <ArrowDownToLine className="h-5 w-5 text-emerald-400" />
            <div>
              <div className="text-xs text-muted-foreground">Gold Returned</div>
              <div className="font-mono text-lg">{formatWeight(todayReturn)}</div>
            </div>
            <Badge variant="outline" className="ml-auto">
              Today
            </Badge>
          </Link>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          to="/workshop/gold-book"
          className="rounded-xl border border-border bg-card p-4 text-sm hover:border-gold/40"
        >
          <Users className="mb-2 h-4 w-4 text-gold" />
          Worker Gold Book
        </Link>
        <Link
          to="/workshop"
          className="rounded-xl border border-border bg-card p-4 text-sm hover:border-gold/40"
        >
          <BookOpen className="mb-2 h-4 w-4 text-gold" />
          Jeweller Gold Book
        </Link>
        <Link
          to="/billing"
          className="rounded-xl border border-border bg-card p-4 text-sm hover:border-gold/40"
        >
          <IndianRupee className="mb-2 h-4 w-4 text-gold" />
          Workshop Billing
        </Link>
      </div>
    </div>
  );
}
