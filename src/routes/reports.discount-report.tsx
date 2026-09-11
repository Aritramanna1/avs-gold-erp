import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useBilling, paiseToRupees } from "@/lib/billing-store";
import { useSettings } from "@/lib/settings-store";
import { mgToGrams } from "@/lib/gold";
import { getCurrentGoldRatePaise } from "@/lib/bullion-rate-service";
import { exportToCSV, triggerPrint } from "@/lib/report-engine";
import { Download, Printer, Tag, Percent, Receipt, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/reports/discount-report" as any)({
  head: () => ({ meta: [{ title: "Discount Report · AVS Gold ERP" }] }),
  component: DiscountReportPage,
});

interface DiscountRow {
  id: string;
  invoiceId: string;
  invoiceNo: string;
  date: string;
  customerName: string;
  itemName: string;
  category: string;
  discountPaise: number;
  discountGoldMg: number;
  grossMg: number;
  netMg: number;
  ratePerGramPaise: number;
  taxImpactPaise: number;
  branchId?: string;
  salesman?: string;
}

function DiscountReportPage() {
  const invoices = useBilling((s) => s.invoices);
  const selectedBranchId = useSettings((s) => s.selectedBranchId);
  const goldRatePaise = getCurrentGoldRatePaise();

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const discountRows: DiscountRow[] = useMemo(() => {
    const rows: DiscountRow[] = [];

    for (const inv of invoices) {
      if (inv.status === "cancelled") continue;
      const invDate = new Date(inv.createdAt).toISOString().split("T")[0];

      if (startDate && invDate < startDate) continue;
      if (endDate && invDate > endDate) continue;

      for (const item of inv.items || []) {
        const discPaise = item.discountPaise || 0;
        const discGoldMg = item.discountGoldMg || 0;

        if (discPaise > 0 || discGoldMg > 0) {
          const rate = item.goldRatePerGramPaise || goldRatePaise;
          const goldEquivMg = discGoldMg > 0 ? discGoldMg : rate > 0 ? Math.round((discPaise / rate) * 1000) : 0;
          const taxImpact = Math.round(discPaise * 0.03); // 3% GST impact

          rows.push({
            id: `${inv.id}_${item.id}`,
            invoiceId: inv.id,
            invoiceNo: inv.invoiceNo,
            date: new Date(inv.createdAt).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            }),
            customerName: inv.customerName,
            itemName: item.itemName || "Item",
            category: item.category || "Jewellery",
            discountPaise: discPaise,
            discountGoldMg: goldEquivMg,
            grossMg: item.grossMg || 0,
            netMg: item.netMg || 0,
            ratePerGramPaise: rate,
            taxImpactPaise: taxImpact,
            branchId: inv.branchId,
            salesman: inv.salesman,
          });
        }
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return rows.filter(
        (r) =>
          r.customerName.toLowerCase().includes(q) ||
          r.invoiceNo.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          r.itemName.toLowerCase().includes(q),
      );
    }

    return rows;
  }, [invoices, startDate, endDate, searchQuery, goldRatePaise]);

  const totalDiscountPaise = discountRows.reduce((s, r) => s + r.discountPaise, 0);
  const totalDiscountGoldMg = discountRows.reduce((s, r) => s + r.discountGoldMg, 0);
  const totalTaxImpactPaise = discountRows.reduce((s, r) => s + r.taxImpactPaise, 0);

  const handleExportCSV = () => {
    const header = [
      "Date",
      "Invoice #",
      "Customer",
      "Item Name",
      "Category",
      "Discount (₹)",
      "Gold Equiv (g)",
      "Tax Impact (₹)",
      "Salesman",
    ];

    const data = discountRows.map((r) => [
      r.date,
      r.invoiceNo,
      r.customerName,
      r.itemName,
      r.category,
      paiseToRupees(r.discountPaise),
      mgToGrams(r.discountGoldMg),
      paiseToRupees(r.taxImpactPaise),
      r.salesman || "—",
    ]);

    exportToCSV("Discount_Report.csv", [header, ...data]);
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Discount Report"
        subtitle="Dedicated audit report of discounts allowed on billing invoices, gold weight equivalents, and tax impacts."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExportCSV} disabled={discountRows.length === 0}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => triggerPrint()} disabled={discountRows.length === 0}>
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-card rounded-lg border border-border shadow-sm space-y-1">
          <span className="text-[10px] uppercase font-bold text-muted-foreground">Total Discounts Allowed</span>
          <div className="text-xl font-bold font-mono text-foreground">
            ₹ {paiseToRupees(totalDiscountPaise)}
          </div>
          <div className="text-xs text-muted-foreground font-medium">
            Across {discountRows.length} Line Item{discountRows.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="p-4 bg-amber-500/5 rounded-lg border border-amber-500/20 shadow-sm space-y-1">
          <span className="text-[10px] uppercase font-bold text-amber-400">Gold Equivalent Weight</span>
          <div className="text-xl font-bold font-mono text-amber-300">
            {mgToGrams(totalDiscountGoldMg)} g Gold
          </div>
          <div className="text-xs text-muted-foreground font-mono">
            Valued at benchmark rates
          </div>
        </div>

        <div className="p-4 bg-card rounded-lg border border-border shadow-sm space-y-1">
          <span className="text-[10px] uppercase font-bold text-muted-foreground">Tax Relief / Impact (3% GST)</span>
          <div className="text-xl font-bold font-mono text-foreground">
            ₹ {paiseToRupees(totalTaxImpactPaise)}
          </div>
          <div className="text-xs text-muted-foreground font-mono">
            Reduced GST liability
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 bg-card rounded-lg border border-border shadow-sm flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center flex-1">
          <Input
            placeholder="Search by customer, invoice, category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-xs text-xs"
          />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>From</span>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36 text-xs" />
            <span>To</span>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36 text-xs" />
          </div>
        </div>

        {(startDate || endDate || searchQuery) && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => {
              setStartDate("");
              setEndDate("");
              setSearchQuery("");
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px]">
              <tr className="border-b border-border text-left">
                <th className="p-3">Invoice #</th>
                <th className="p-3">Date</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Item & Category</th>
                <th className="p-3 text-right">Discount (₹)</th>
                <th className="p-3 text-right">Gold Equiv (g)</th>
                <th className="p-3 text-right">Tax Impact (₹)</th>
                <th className="p-3 text-center">Salesman</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {discountRows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-3 font-mono font-semibold text-gold">{r.invoiceNo}</td>
                  <td className="p-3 text-muted-foreground">{r.date}</td>
                  <td className="p-3 font-medium text-foreground">{r.customerName}</td>
                  <td className="p-3">
                    <span className="font-medium">{r.itemName}</span>
                    <Badge variant="outline" className="ml-2 text-[9px]">
                      {r.category}
                    </Badge>
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-foreground">
                    ₹ {paiseToRupees(r.discountPaise)}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-amber-300">
                    {mgToGrams(r.discountGoldMg)} g
                  </td>
                  <td className="p-3 text-right font-mono text-muted-foreground">
                    ₹ {paiseToRupees(r.taxImpactPaise)}
                  </td>
                  <td className="p-3 text-center text-muted-foreground">{r.salesman || "—"}</td>
                </tr>
              ))}
              {discountRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-muted-foreground">
                    No discounts found matching the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
