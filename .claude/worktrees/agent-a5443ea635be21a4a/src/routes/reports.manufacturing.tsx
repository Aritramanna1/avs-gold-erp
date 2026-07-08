import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { useMfgBills } from "@/lib/manufacturing-bill-store";
import { useSettings } from "@/lib/settings-store";
import {
  thisMonthRange,
  exportToXLSX,
  exportToCSV,
  fmtG,
  fmtRs,
  fmtDate,
} from "@/lib/report-engine";
import type { MfgBillStatus } from "@/lib/manufacturing-bill-store";

export const Route = createFileRoute("/reports/manufacturing")({
  head: () => ({ meta: [{ title: "Manufacturing Dashboard · MTJ ERP" }] }),
  component: ManufacturingReport,
});

const STATUS_COLORS: Record<MfgBillStatus, string> = {
  draft: "secondary",
  finalised: "default",
  delivered: "default",
  settled: "default",
};

export default function ManufacturingReport() {
  const bills = useMfgBills((s) => s.bills);
  const branches = useSettings((s) => s.branches);
  const range = thisMonthRange();
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [selectedBranch, setSelectedBranch] = useState("all");

  const filtered = useMemo(() => {
    return bills.filter((b) => {
      const d = new Date(b.createdAt).toISOString().slice(0, 10);
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (selectedBranch !== "all" && b.branchId !== selectedBranch) return false;
      return true;
    });
  }, [bills, from, to, selectedBranch]);

  const activeBills = filtered.filter((b) => b.status === "draft" || b.status === "finalised");
  const totalLabour = filtered.reduce((s, b) => s + b.labourChargesPaise, 0);
  const avgWastage =
    filtered.length > 0
      ? filtered.reduce((s, b) => s + b.actualWastagePct, 0) / filtered.length
      : 0;

  // Bills per day chart
  const byDay = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((b) => {
      const d = new Date(b.createdAt).toISOString().slice(0, 10);
      map[d] = (map[d] ?? 0) + 1;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));
  }, [filtered]);

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
    const data = filtered.map((b) => [
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
    const data = filtered.map((b) => [
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
      onFromChange={setFrom}
      onToChange={setTo}
      selectedBranch={selectedBranch}
      onBranchChange={setSelectedBranch}
      branches={branches}
      onPDF={() => {}}
      onXLSX={handleXLSX}
      onCSV={handleCSV}
    >
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Active Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{activeBills.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Bills This Period</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{filtered.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Avg Wastage %</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{avgWastage.toFixed(2)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Total Labour</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{fmtRs(totalLabour)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
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
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-muted-foreground">
                  No manufacturing bills in this period.
                </td>
              </tr>
            )}
            {filtered.map((b, i) => (
              <tr key={b.id} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                <td className="p-3 font-mono text-xs">{b.billNo}</td>
                <td className="p-3 text-xs">{fmtDate(b.createdAt)}</td>
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
