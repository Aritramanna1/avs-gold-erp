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
import { useBilling } from "@/lib/billing-store";
import { useOrders } from "@/lib/orders-store";
import { useRepairs } from "@/lib/repair-store";
import { usePeople } from "@/lib/people-store";
import { useSettings } from "@/lib/settings-store";
import { thisMonthRange, exportToXLSX, exportToCSV, fmtRs } from "@/lib/report-engine";

export const Route = createFileRoute("/reports/branch")({
  head: () => ({ meta: [{ title: "Branch Performance · MTJ ERP" }] }),
  component: BranchReport,
});

export default function BranchReport() {
  const invoices = useBilling((s) => s.invoices);
  const orders = useOrders((s) => s.orders);
  const repairs = useRepairs((s) => s.repairs);
  const people = usePeople((s) => s.people);
  const branches = useSettings((s) => s.branches);
  const range = thisMonthRange();
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [selectedBranch, setSelectedBranch] = useState("all");

  const inRange = (ts: number) => {
    const d = new Date(ts).toISOString().slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  };

  const branchStats = useMemo(() => {
    return branches.map((branch) => {
      const bid = branch.id;
      const branchInvoices = invoices.filter(
        (i) =>
          inRange(i.createdAt) &&
          ((i as unknown as Record<string, string>).branchId ?? "MAIN") === bid,
      );
      const salesPaise = branchInvoices.reduce((s, i) => s + i.grandTotalPaise, 0);
      const outstandingPaise = branchInvoices.reduce((s, i) => s + i.balancePaise, 0);
      const branchOrders = orders.filter(
        (o) => inRange(o.createdAt) && (o.branchId ?? "MAIN") === bid,
      );
      const branchRepairs = repairs.filter(
        (r) =>
          inRange(r.createdAt) &&
          ((r as unknown as Record<string, string>).branchId ?? "MAIN") === bid,
      );
      const customers = new Set(branchInvoices.map((i) => i.customerId)).size;
      return {
        id: bid,
        name: branch.name,
        salesPaise,
        outstandingPaise,
        orders: branchOrders.length,
        repairs: branchRepairs.length,
        customers,
      };
    });
  }, [invoices, orders, repairs, branches, from, to]);

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
            {branchStats.length === 0 && (
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
