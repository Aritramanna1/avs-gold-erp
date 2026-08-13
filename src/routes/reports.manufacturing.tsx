import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ReportShell } from "@/components/report-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useSettings } from "@/lib/settings-store";
import {
  thisMonthRange,
  exportToXLSX,
  exportToCSV,
  fmtG,
  fmtRs,
  type ReportPeriod,
} from "@/lib/report-engine";
import { ReportPeriodToggle } from "@/components/report-period-toggle";
import type { MfgBillStatus } from "@/lib/manufacturing-bill-store";
import {
  fetchManufacturingReportBills,
  type ManufacturingReportBill,
} from "@/lib/manufacturing-report-query";
import { EmptyState, WebAppState } from "@/components/web-app-state";
import { AlertTriangle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/reports/manufacturing")({
  head: () => ({ meta: [{ title: "Manufacturing Dashboard · AVS Gold ERP" }] }),
  component: ManufacturingReport,
});

const STATUS_COLORS: Record<MfgBillStatus, string> = {
  draft: "secondary",
  finalised: "default",
  delivered: "default",
  settled: "default",
};

function fmtReportDate(value: string): string {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toLocaleDateString() : value.slice(0, 10);
}

function ManufacturingReport() {
  const branches = useSettings((s) => s.branches);
  const range = thisMonthRange();
  const [period, setPeriod] = useState<ReportPeriod>("monthly");
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [rows, setRows] = useState<ManufacturingReportBill[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [capped, setCapped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchManufacturingReportBills({
      from,
      to,
      branchId: selectedBranch,
    })
      .then((result) => {
        if (cancelled) return;
        setRows(result.rows);
        setTotalCount(result.totalCount);
        setCapped(result.capped);
      })
      .catch((err) => {
        if (cancelled) return;
        setRows([]);
        setTotalCount(0);
        setCapped(false);
        setError(err instanceof Error ? err.message : "Could not load manufacturing report.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to, selectedBranch, reloadKey]);

  const activeBills = rows.filter((b) => b.status === "draft" || b.status === "finalised");
  const totalLabour = rows.reduce((s, b) => s + b.labourChargesPaise, 0);
  const avgWastage =
    rows.length > 0 ? rows.reduce((s, b) => s + b.actualWastagePct, 0) / rows.length : 0;

  // Bills per day chart
  const byDay = useMemo(() => {
    const map: Record<string, number> = {};
    rows.forEach((b) => {
      const d = new Date(b.createdAt).toISOString().slice(0, 10);
      map[d] = (map[d] ?? 0) + 1;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));
  }, [rows]);

  function handleXLSX() {
    const header = [
      "Bill No",
      "Item",
      "Karigar",
      "Issued (g)",
      "Returned (g)",
      "Wastage %",
      "Labour ₹",
      "Status",
    ];
    const data = rows.map((b) => [
      b.billNo,
      b.itemName,
      b.karigarName ?? "",
      (b.totalGoldIssuedFineMg / 1000).toFixed(3),
      (b.totalGoldReturnedFineMg / 1000).toFixed(3),
      b.actualWastagePct.toFixed(2) + "%",
      (b.labourChargesPaise / 100).toFixed(2),
      b.status,
    ]);
    exportToXLSX("manufacturing.xlsx", { Manufacturing: [header, ...data] });
  }

  function handleCSV() {
    const header = [
      "Bill No",
      "Item",
      "Karigar",
      "Issued (g)",
      "Returned (g)",
      "Wastage %",
      "Labour ₹",
      "Status",
    ];
    const data = rows.map((b) => [
      b.billNo,
      b.itemName,
      b.karigarName ?? "",
      (b.totalGoldIssuedFineMg / 1000).toFixed(3),
      (b.totalGoldReturnedFineMg / 1000).toFixed(3),
      b.actualWastagePct.toFixed(2) + "%",
      (b.labourChargesPaise / 100).toFixed(2),
      b.status,
    ]);
    exportToCSV("manufacturing.csv", [header, ...data]);
  }

  return (
    <ReportShell
      title="Manufacturing Dashboard"
      subtitle="Production bills and karigar performance"
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
            <CardTitle className="text-xs text-muted-foreground">Active Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{loading ? "..." : activeBills.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Bills This Period</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{loading ? "..." : totalCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Avg Wastage %</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{loading ? "..." : `${avgWastage.toFixed(2)}%`}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Total Labour</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{loading ? "..." : fmtRs(totalLabour)}</p>
          </CardContent>
        </Card>
      </div>

      {capped && (
        <WebAppState
          tone="warning"
          title="Report preview capped"
          description={`Showing the latest ${rows.length} of ${totalCount} manufacturing bills for this period. Narrow the date or branch before exporting final numbers.`}
        />
      )}

      {error && (
        <WebAppState
          tone="danger"
          icon={<AlertTriangle className="h-5 w-5" />}
          title="Could not load manufacturing report"
          description={error}
          action={{ label: "Retry", onClick: () => setReloadKey((v) => v + 1) }}
        />
      )}

      {/* Table */}
      {/* Mobile view */}
      <div className="block md:hidden space-y-3">
        {loading && (
          <div className="p-8 text-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading...
          </div>
        )}
        {!loading && !error && rows.length === 0 && (
          <div className="p-6 bg-card border border-border rounded-xl text-center text-muted-foreground text-xs">
            No manufacturing bills in this period.
          </div>
        )}
        {!loading &&
          !error &&
          rows.map((b) => (
            <div
              key={b.id}
              className="rounded-2xl border border-border bg-card p-4 space-y-3 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-gold font-semibold">{b.billNo}</span>
                <Badge variant={STATUS_COLORS[b.status] as "default" | "secondary"}>
                  {b.status}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground block text-[10px]">Item</span>
                  <span className="font-medium text-foreground">{b.itemName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Karigar</span>
                  <span className="font-medium text-foreground">{b.karigarName ?? "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Date</span>
                  <span className="font-medium text-foreground">{fmtReportDate(b.createdAt)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Labour</span>
                  <span className="font-medium text-foreground">{fmtRs(b.labourChargesPaise)}</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[11px] font-mono bg-muted/20 p-2 rounded-lg text-center">
                <div>
                  <span className="text-[9px] text-muted-foreground block font-sans">Issued</span>
                  <span>{fmtG(b.totalGoldIssuedFineMg)}g</span>
                </div>
                <div>
                  <span className="text-[9px] text-muted-foreground block font-sans">Returned</span>
                  <span>{fmtG(b.totalGoldReturnedFineMg)}g</span>
                </div>
                <div>
                  <span className="text-[9px] text-muted-foreground block font-sans">Wastage</span>
                  <span>{b.actualWastagePct.toFixed(2)}%</span>
                </div>
              </div>
            </div>
          ))}
      </div>

      {/* Desktop view */}
      <div className="hidden md:block overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-semibold">Bill No</th>
              <th className="text-left p-3 font-semibold">Date</th>
              <th className="text-left p-3 font-semibold">Item</th>
              <th className="text-left p-3 font-semibold">Karigar</th>
              <th className="text-right p-3 font-semibold">Issued</th>
              <th className="text-right p-3 font-semibold">Returned</th>
              <th className="text-right p-3 font-semibold">Wastage %</th>
              <th className="text-right p-3 font-semibold">Labour</th>
              <th className="text-center p-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} className="p-8 text-center text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading manufacturing report...
                  </span>
                </td>
              </tr>
            )}
            {!loading && !error && rows.length === 0 && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-muted-foreground">
                  <EmptyState
                    title="No manufacturing bills in this period"
                    description="Change the date range or branch to inspect another manufacturing period."
                  />
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              rows.map((b, i) => (
                <tr key={b.id} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                  <td className="p-3 font-mono text-xs">{b.billNo}</td>
                  <td className="p-3 text-xs">{fmtReportDate(b.createdAt)}</td>
                  <td className="p-3">{b.itemName}</td>
                  <td className="p-3">{b.karigarName ?? "—"}</td>
                  <td className="p-3 text-right">{fmtG(b.totalGoldIssuedFineMg)}</td>
                  <td className="p-3 text-right">{fmtG(b.totalGoldReturnedFineMg)}</td>
                  <td className="p-3 text-right">{b.actualWastagePct.toFixed(2)}%</td>
                  <td className="p-3 text-right">{fmtRs(b.labourChargesPaise)}</td>
                  <td className="p-3 text-center">
                    <Badge variant={STATUS_COLORS[b.status] as "default" | "secondary"}>
                      {b.status}
                    </Badge>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bills Per Day</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={byDay} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#d97706"
                strokeWidth={2}
                dot={false}
                name="Bills"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </ReportShell>
  );
}
