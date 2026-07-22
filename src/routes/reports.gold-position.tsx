import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { useLedger, computeBalances } from "@/lib/ledger-store";
import type { Bucket } from "@/lib/ledger-store";
import { useSettings } from "@/lib/settings-store";
import {
  thisMonthRange,
  exportToXLSX,
  exportToCSV,
  fmtG,
  type ReportPeriod,
} from "@/lib/report-engine";
import { ReportPeriodToggle } from "@/components/report-period-toggle";

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

export default function GoldPositionReport() {
  const entries = useLedger((s) => s.entries);
  const branches = useSettings((s) => s.branches);
  const range = thisMonthRange();
  const [period, setPeriod] = useState<ReportPeriod>("monthly");
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [selectedBranch, setSelectedBranch] = useState("all");

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      const d = new Date(e.createdAt).toISOString().slice(0, 10);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [entries, from, to]);

  const balance = useMemo(() => computeBalances(filteredEntries), [filteredEntries]);

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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Total Under Management</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{fmtG(totalMg)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Vault Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{fmtG(Math.max(0, balance.buckets.vault))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">
              Gold With Workers (Owed Back)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{fmtG(Math.max(0, balance.buckets.karigar))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Scrap Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{fmtG(Math.max(0, balance.buckets.scrap))}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
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
            {rows.map((r, i) => (
              <tr key={r.bucket} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                <td className="p-3 font-medium">{r.label}</td>
                <td className="p-3 text-right">{(r.fineMg / 1000).toFixed(3)}</td>
                <td className="p-3 text-right">{(r.grossMg / 1000).toFixed(3)}</td>
                <td className="p-3 text-right">{r.pct}%</td>
              </tr>
            ))}
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
