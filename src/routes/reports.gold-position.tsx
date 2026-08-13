import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ReportShell } from "@/components/report-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import type { BalanceSheet, Bucket } from "@/lib/ledger-store";
import { useSettings } from "@/lib/settings-store";
import {
  thisMonthRange,
  exportToXLSX,
  exportToCSV,
  fmtG,
  type ReportPeriod,
} from "@/lib/report-engine";
import { ReportPeriodToggle } from "@/components/report-period-toggle";
import { fetchGoldPositionReport } from "@/lib/gold-position-report-query";
import { EmptyState, WebAppState } from "@/components/web-app-state";
import { AlertTriangle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/reports/gold-position")({
  head: () => ({ meta: [{ title: "Gold Position · AVS Gold ERP" }] }),
  component: GoldPositionReport,
});

const BUCKET_LABELS: Record<Bucket, string> = {
  vault: "Gold Held",
  karigar: "Karigar",
  finished: "Finished",
  customer: "Customer",
  jeweller: "Jewellers",
  scrap: "Scrap",
};

const EMPTY_BALANCE: BalanceSheet = {
  buckets: {
    vault: 0,
    karigar: 0,
    finished: 0,
    customer: 0,
    jeweller: 0,
    scrap: 0,
  },
  bucketBreakdowns: {
    vault: { fineMg: 0, grossMg: 0, purities: {}, cashPaise: 0 },
    karigar: { fineMg: 0, grossMg: 0, purities: {}, cashPaise: 0 },
    finished: { fineMg: 0, grossMg: 0, purities: {}, cashPaise: 0 },
    customer: { fineMg: 0, grossMg: 0, purities: {}, cashPaise: 0 },
    jeweller: { fineMg: 0, grossMg: 0, purities: {}, cashPaise: 0 },
    scrap: { fineMg: 0, grossMg: 0, purities: {}, cashPaise: 0 },
  },
  cashBuckets: {
    vault: 0,
    karigar: 0,
    finished: 0,
    customer: 0,
    jeweller: 0,
    scrap: 0,
  },
  totalUnderManagement: 0,
  totalPhysicalUnderManagement: 0,
  ledgerTotal: 0,
  discrepancyMg: 0,
  balanced: true,
  entryCount: 0,
  totalCashPaise: 0,
};

function GoldPositionReport() {
  const branches = useSettings((s) => s.branches);
  const range = thisMonthRange();
  const [period, setPeriod] = useState<ReportPeriod>("monthly");
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [balance, setBalance] = useState<BalanceSheet>(EMPTY_BALANCE);
  const [entryCount, setEntryCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [capped, setCapped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchGoldPositionReport({
      from,
      to,
      branchId: selectedBranch,
    })
      .then((result) => {
        if (cancelled) return;
        setBalance(result.balance);
        setEntryCount(result.entryCount);
        setTotalCount(result.totalCount);
        setCapped(result.capped);
      })
      .catch((err) => {
        if (cancelled) return;
        setBalance(EMPTY_BALANCE);
        setEntryCount(0);
        setTotalCount(0);
        setCapped(false);
        setError(err instanceof Error ? err.message : "Unable to load gold position report.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to, selectedBranch, reloadKey]);

  const BUCKETS: Bucket[] = ["vault", "karigar", "finished", "customer", "scrap"];
  const totalMg = BUCKETS.reduce((s, b) => s + Math.max(0, balance.buckets[b]), 0);

  const rows = BUCKETS.map((b) => {
    const fineMg = Math.max(0, balance.buckets[b]);
    const breakdown = balance.bucketBreakdowns[b];
    const grossMg = breakdown?.grossMg ?? 0;
    const pct = totalMg > 0 ? ((fineMg / totalMg) * 100).toFixed(1) : "0.0";
    return { bucket: b, label: BUCKET_LABELS[b], fineMg, grossMg, pct };
  });

  const chartData = rows.map((r) => ({
    name: r.label,
    "Fine Gold (g)": parseFloat((r.fineMg / 1000).toFixed(3)),
  }));

  function handleXLSX() {
    const header = ["Bucket", "Fine Gold (g)", "Gross Gold (g)", "% of Total"];
    const data = rows.map((r) => [
      r.label,
      (r.fineMg / 1000).toFixed(3),
      (r.grossMg / 1000).toFixed(3),
      r.pct + "%",
    ]);
    exportToXLSX("gold-position.xlsx", { "Gold Position": [header, ...data] });
  }

  function handleCSV() {
    const header = ["Bucket", "Fine Gold (g)", "Gross Gold (g)", "% of Total"];
    const data = rows.map((r) => [
      r.label,
      (r.fineMg / 1000).toFixed(3),
      (r.grossMg / 1000).toFixed(3),
      r.pct + "%",
    ]);
    exportToCSV("gold-position.csv", [header, ...data]);
  }

  return (
    <ReportShell
      title="Gold Position Report"
      subtitle="Five-bucket gold balance sheet"
      from={from}
      to={to}
      onFromChange={(v) => {
        setPeriod("custom");
        setFrom(v);
      }}
      onToChange={(v) => {
        setPeriod("custom");
        setTo(v);
      }}
      selectedBranch={selectedBranch}
      onBranchChange={setSelectedBranch}
      branches={branches}
      onXLSX={handleXLSX}
      onCSV={handleCSV}
    >
      <ReportPeriodToggle
        period={period}
        range={{ from, to }}
        onChange={(p, r) => {
          setPeriod(p);
          setFrom(r.from);
          setTo(r.to);
        }}
      />

      {error && (
        <WebAppState
          tone="danger"
          icon={<AlertTriangle className="h-5 w-5" />}
          title="Gold position could not be loaded"
          description={error}
          action={{ label: "Retry", onClick: () => setReloadKey((value) => value + 1) }}
        />
      )}

      {capped && !error && (
        <WebAppState
          tone="warning"
          icon={<AlertTriangle className="h-5 w-5" />}
          title="Large ledger preview"
          description={`Showing the first ${entryCount.toLocaleString("en-IN")} authorized ledger entries out of ${totalCount.toLocaleString("en-IN")} for this period. Narrow the date or branch filter before using the totals for closing.`}
        />
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Total Under Management</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{loading ? "..." : fmtG(totalMg)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Vault Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">
              {loading ? "..." : fmtG(Math.max(0, balance.buckets.vault))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Karigar Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">
              {loading ? "..." : fmtG(Math.max(0, balance.buckets.karigar))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Scrap Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">
              {loading ? "..." : fmtG(Math.max(0, balance.buckets.scrap))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border" aria-busy={loading}>
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-semibold">Bucket</th>
              <th className="text-right p-3 font-semibold">Fine Gold (g)</th>
              <th className="text-right p-3 font-semibold">Gross Gold (g)</th>
              <th className="text-right p-3 font-semibold">% of Total</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="p-6 text-center text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading authorized ledger balances...
                  </span>
                </td>
              </tr>
            ) : rows.every((r) => r.fineMg === 0 && r.grossMg === 0) ? (
              <tr>
                <td colSpan={4} className="p-4">
                  <EmptyState
                    title="No gold ledger movement found"
                    description="Change the date range or branch filter to inspect another ledger period."
                  />
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={r.bucket} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                  <td className="p-3 font-medium">{r.label}</td>
                  <td className="p-3 text-right">{(r.fineMg / 1000).toFixed(3)}</td>
                  <td className="p-3 text-right">{(r.grossMg / 1000).toFixed(3)}</td>
                  <td className="p-3 text-right">{r.pct}%</td>
                </tr>
              ))
            )}
            <tr className="border-t font-bold bg-muted/40">
              <td className="p-3">Total</td>
              <td className="p-3 text-right">{(totalMg / 1000).toFixed(3)}</td>
              <td className="p-3 text-right">—</td>
              <td className="p-3 text-right">100%</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bucket Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis unit="g" />
              <Tooltip formatter={(v: number) => [`${v}g`, "Fine Gold"]} />
              <Legend />
              <Bar dataKey="Fine Gold (g)" fill="#d97706" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </ReportShell>
  );
}
