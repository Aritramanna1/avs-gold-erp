import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ReportShell } from "@/components/report-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { useSettings } from "@/lib/settings-store";
import { fetchBranchReport, type BranchReportRow } from "@/lib/branch-report-query";
import {
  thisMonthRange,
  exportToXLSX,
  exportToCSV,
  fmtRs,
  type ReportPeriod,
} from "@/lib/report-engine";
import { ReportPeriodToggle } from "@/components/report-period-toggle";

export const Route = createFileRoute("/reports/branch")({
  head: () => ({ meta: [{ title: "Branch Performance · AVS Gold ERP" }] }),
  component: BranchReport,
});

function BranchReport() {
  const branches = useSettings((s) => s.branches);
  const range = thisMonthRange();
  const [period, setPeriod] = useState<ReportPeriod>("monthly");
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [branchStats, setBranchStats] = useState<BranchReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setLoadError(null);
    fetchBranchReport({ branches, from, to })
      .then((rows) => {
        if (live) setBranchStats(rows);
      })
      .catch((error: any) => {
        if (live) setLoadError(error?.message ?? "Could not load branch report.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [branches, from, to]);

  // Totals for filtered branch if one is selected
  const displayStats =
    selectedBranch === "all" ? branchStats : branchStats.filter((b) => b.id === selectedBranch);

  const totalSales = displayStats.reduce((s, b) => s + b.salesPaise, 0);
  const totalOutstanding = displayStats.reduce((s, b) => s + b.outstandingPaise, 0);
  const totalOrders = displayStats.reduce((s, b) => s + b.orders, 0);
  const totalRepairs = displayStats.reduce((s, b) => s + b.repairs, 0);

  const chartData = branchStats.map((b) => ({
    name: b.name,
    "Sales (₹)": parseFloat((b.salesPaise / 100).toFixed(2)),
    "Outstanding (₹)": parseFloat((b.outstandingPaise / 100).toFixed(2)),
  }));

  function handleXLSX() {
    const header = ["Branch", "Sales ₹", "Outstanding ₹", "Orders", "Repairs", "Customers"];
    const data = branchStats.map((b) => [
      b.name,
      (b.salesPaise / 100).toFixed(2),
      (b.outstandingPaise / 100).toFixed(2),
      b.orders,
      b.repairs,
      b.customers,
    ]);
    exportToXLSX("branch-performance.xlsx", { "Branch Performance": [header, ...data] });
  }

  function handleCSV() {
    const header = ["Branch", "Sales ₹", "Outstanding ₹", "Orders", "Repairs", "Customers"];
    const data = branchStats.map((b) => [
      b.name,
      (b.salesPaise / 100).toFixed(2),
      (b.outstandingPaise / 100).toFixed(2),
      b.orders,
      b.repairs,
      b.customers,
    ]);
    exportToCSV("branch-performance.csv", [header, ...data]);
  }

  return (
    <ReportShell
      title="Branch Performance Report"
      subtitle="Sales, outstanding, and activity per branch"
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

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Total Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{fmtRs(totalSales)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-destructive">{fmtRs(totalOutstanding)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{totalOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Repairs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{totalRepairs}</p>
          </CardContent>
        </Card>
      </div>

      {loadError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="text-destructive">{loadError}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() =>
              void fetchBranchReport({ branches, from, to })
                .then(setBranchStats)
                .catch((error: any) => setLoadError(error?.message ?? "Could not load report."))
            }
          >
            Retry
          </Button>
        </div>
      )}
      {loading && (
        <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          Loading branch performance...
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-semibold">Branch</th>
              <th className="text-right p-3 font-semibold">Sales ₹</th>
              <th className="text-right p-3 font-semibold">Outstanding ₹</th>
              <th className="text-right p-3 font-semibold">Orders</th>
              <th className="text-right p-3 font-semibold">Repairs</th>
              <th className="text-right p-3 font-semibold">Customers</th>
            </tr>
          </thead>
          <tbody>
            {!loading && !loadError && branchStats.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  No branches configured.
                </td>
              </tr>
            )}
            {branchStats.map((b, i) => (
              <tr key={b.id} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                <td className="p-3 font-medium">{b.name}</td>
                <td className="p-3 text-right">{fmtRs(b.salesPaise)}</td>
                <td className="p-3 text-right text-destructive">{fmtRs(b.outstandingPaise)}</td>
                <td className="p-3 text-right">{b.orders}</td>
                <td className="p-3 text-right">{b.repairs}</td>
                <td className="p-3 text-right">{b.customers}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Branch Comparison — Sales vs Outstanding</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
              <Legend />
              <Bar dataKey="Sales (₹)" fill="#d97706" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Outstanding (₹)" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </ReportShell>
  );
}
