import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBilling } from "@/lib/billing-store";
import { useExpensesStore } from "@/lib/expenses-store";
import { compileTotalProfitReport } from "@/lib/total-profit-engine";
import { thisMonthRange, fmtRs, fmtG, triggerPrint, exportToCSV } from "@/lib/report-engine";
import { useSettings } from "@/lib/settings-store";
import { Download, Printer, TrendingUp, TrendingDown, DollarSign, Wallet, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/reports/total-profit")({
  head: () => ({ meta: [{ title: "Total Profit Earned · MTJ ERP" }] }),
  component: TotalProfitPage,
});

function TotalProfitPage() {
  const month = thisMonthRange();
  const [from, setFrom] = useState(month.from);
  const [to, setTo] = useState(month.to);
  const invoices = useBilling((s) => s.invoices);
  const expenses = useExpensesStore((s) => s.expenses);
  const withdrawals = useExpensesStore((s) => s.withdrawals);
  const branding = useSettings((s) => s.branding);
  const firm = useSettings((s) => s.firm);
  const companyName = firm?.shopName || branding.companyName || "Ma Tara Jewellers";

  const fromMs = useMemo(() => new Date(from).setHours(0, 0, 0, 0), [from]);
  const toMs = useMemo(() => new Date(to).setHours(23, 59, 59, 999), [to]);

  const report = useMemo(
    () => compileTotalProfitReport(fromMs, toMs),
    [fromMs, toMs, invoices, expenses, withdrawals],
  );

  function handleCSV() {
    exportToCSV("total-profit-report.csv", [
      ["Metric", "Rupees (₹)", "Gold Equivalent (g)"],
      ["Gross Revenue", fmtRs(report.grossRevenuePaise), `${fmtG(report.grossRevenueFineMg)} g`],
      ["Making Charges Collected", fmtRs(report.makingChargesPaise), "—"],
      ["Direct Work / Karigar Cost", fmtRs(report.directWorkCostPaise), "—"],
      ["Gross Business Profit", fmtRs(report.grossProfitPaise), "—"],
      ["Gross Profit Margin %", `${report.grossProfitMarginPct.toFixed(2)}%`, "—"],
      ["Business Operating Expenses", fmtRs(report.businessExpensesPaise), `${fmtG(report.businessExpensesFineMg)} g`],
      ["Net Business Profit", fmtRs(report.netBusinessProfitPaise), `${fmtG(report.netBusinessProfitFineMg)} g`],
      ["Net Profit Margin %", `${report.netProfitMarginPct.toFixed(2)}%`, "—"],
      ["Owner Drawings / Personal", fmtRs(report.ownerDrawingsPaise), `${fmtG(report.ownerDrawingsFineMg)} g`],
      ["Net Equity Retained in Business", fmtRs(report.netEquityImpactPaise), "—"],
    ]);
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 print:p-4 print:max-w-none print:m-0 print:space-y-4 print:text-black">
      {/* Print-Only Branded Header */}
      <div className="hidden print:block border-b-2 border-black/80 pb-3 mb-4">
        <div className="flex justify-between items-start">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              {branding.logoUrl && (
                <img src={branding.logoUrl} alt="Logo" className="h-8 w-auto max-w-[120px] object-contain" />
              )}
              <h1 className="text-xl font-bold tracking-tight text-black">{companyName}</h1>
            </div>
            {firm?.tagline && <p className="text-xs text-gray-600">{firm.tagline}</p>}
            {firm?.address && <p className="text-[10px] text-gray-500">{firm.address}</p>}
            {(firm?.phone || firm?.gstin) && (
              <p className="text-[10px] text-gray-500">
                {firm?.phone ? `Phone: ${firm.phone}` : ""}
                {firm?.phone && firm?.gstin ? " | " : ""}
                {firm?.gstin ? `GSTIN: ${firm.gstin}` : ""}
              </p>
            )}
          </div>
          <div className="text-right space-y-0.5">
            <h2 className="text-base font-bold text-black uppercase tracking-wider">Total Profit &amp; Loss Statement</h2>
            <p className="text-xs text-gray-600 font-medium">Period: {from} to {to}</p>
            <p className="text-[11px] font-bold text-black mt-1">
              Net Business Profit: {fmtRs(report.netBusinessProfitPaise)} ({fmtG(report.netBusinessProfitFineMg)} g Gold Equiv)
            </p>
            <p className="text-[9px] text-gray-400">
              Printed on: {new Date().toLocaleString("en-IN")}
            </p>
          </div>
        </div>
      </div>

      <div className="print:hidden">
        <PageHeader
          title="Total Profit Earned (Business P&amp;L)"
          subtitle="Accurate business profit calculation separating direct work margins, operating overheads, and owner drawings equity."
          actions={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={handleCSV}>
                <Download className="h-4 w-4" /> CSV
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => triggerPrint()}>
                <Printer className="h-4 w-4" /> Print
              </Button>
            </div>
          }
        />
      </div>

      {/* Date Filters */}
      <div className="flex flex-wrap gap-4 items-end print:hidden">
        <div className="space-y-1.5">
          <Label className="text-xs">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {/* Primary KPI Cards (Gold First + Rupee Value) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border print:border-black/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Gross Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              {fmtRs(report.grossRevenuePaise)}
            </div>
            <p className="text-xs text-gold font-mono mt-1">
              {fmtG(report.grossRevenueFineMg)} g Fine Gold Handled
            </p>
          </CardContent>
        </Card>

        <Card className="border-border print:border-black/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Business Operating Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-destructive">
              {fmtRs(report.businessExpensesPaise)}
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              {fmtG(report.businessExpensesFineMg)} g Gold Equiv · Approved overheads only
            </p>
          </CardContent>
        </Card>

        <Card className="border-border print:border-black/30 bg-emerald-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-emerald-500">
              Net Business Profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold font-mono ${report.isLoss ? "text-destructive" : "text-emerald-500"}`}>
              {fmtRs(report.netBusinessProfitPaise)}
            </div>
            <p className="text-xs text-emerald-400 font-mono mt-1">
              {fmtG(report.netBusinessProfitFineMg)} g Gold Equiv ({report.netProfitMarginPct.toFixed(1)}% margin)
            </p>
          </CardContent>
        </Card>

        <Card className="border-border print:border-black/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-amber-500">
              Owner Drawings (Equity)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-amber-500">
              {fmtRs(report.ownerDrawingsPaise)}
            </div>
            <p className="text-xs text-amber-400 font-mono mt-1">
              {fmtG(report.ownerDrawingsFineMg)} g Gold · Does not reduce operating profit
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Comprehensive Statement Breakdown */}
      <div className="rounded-lg border border-border print:border-black/30 bg-card overflow-hidden">
        <div className="bg-muted/40 p-4 border-b border-border font-semibold text-sm flex justify-between items-center">
          <span>Profit &amp; Loss Breakdown (Gold First Basis)</span>
          <span className="text-xs text-muted-foreground font-mono">Period: {from} to {to}</span>
        </div>

        <div className="divide-y divide-border/60 text-sm">
          {/* Section 1: Business Revenue & Work Margins */}
          <div className="p-4 space-y-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              1. Business Revenue &amp; Direct Margins
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 font-mono text-xs">
              <div className="text-muted-foreground">Gross Invoice Sales Value:</div>
              <div className="text-right font-semibold text-foreground sm:col-span-2">{fmtRs(report.grossRevenuePaise)}</div>

              <div className="text-muted-foreground">Making Charges Earning:</div>
              <div className="text-right font-semibold text-foreground sm:col-span-2">{fmtRs(report.makingChargesPaise)}</div>

              <div className="text-muted-foreground">Less: Direct Karigar / Carrier Labour Cost:</div>
              <div className="text-right text-destructive sm:col-span-2">− {fmtRs(report.directWorkCostPaise)}</div>

              <div className="text-foreground font-bold border-t border-border pt-1">Gross Business Margin:</div>
              <div className="text-right font-bold text-emerald-400 border-t border-border pt-1 sm:col-span-2">
                {fmtRs(report.grossProfitPaise)} ({report.grossProfitMarginPct.toFixed(1)}%)
              </div>
            </div>
          </div>

          {/* Section 2: Business Operating Expenses */}
          <div className="p-4 space-y-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1.5">
              <TrendingDown className="h-3.5 w-3.5 text-destructive" />
              2. Business Operating Expenses (Rent, Salaries, Electricity, Transport)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 font-mono text-xs">
              <div className="text-muted-foreground">Operating Overheads Deducted:</div>
              <div className="text-right text-destructive font-semibold sm:col-span-2">
                − {fmtRs(report.businessExpensesPaise)}
              </div>
              <div className="text-muted-foreground">Gold Equivalent of Expenses:</div>
              <div className="text-right text-gold sm:col-span-2">
                {fmtG(report.businessExpensesFineMg)} g Fine Gold
              </div>
            </div>
          </div>

          {/* Section 3: Net Business Profit */}
          <div className="p-4 bg-emerald-500/5 space-y-2">
            <div className="text-xs uppercase tracking-wider text-emerald-500 font-bold flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5" />
              3. Total Net Business Profit
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 font-mono text-xs">
              <div className="text-foreground font-bold text-base">Net Business Profit (Earnings − Expenses):</div>
              <div className="text-right font-bold text-emerald-400 text-lg sm:col-span-2">
                {fmtRs(report.netBusinessProfitPaise)}
              </div>
              <div className="text-muted-foreground">Gold Equivalent Profit:</div>
              <div className="text-right font-bold text-gold sm:col-span-2">
                {fmtG(report.netBusinessProfitFineMg)} g Pure Gold Earned
              </div>
            </div>
          </div>

          {/* Section 4: Owner Drawings & Equity Reconciliation */}
          <div className="p-4 bg-amber-500/5 space-y-2">
            <div className="text-xs uppercase tracking-wider text-amber-500 font-bold flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5" />
              4. Owner Drawings &amp; Personal Withdrawals (Owner Equity Impact)
            </div>
            <p className="text-[11px] text-muted-foreground">
              * Accounting Rule: Personal &amp; family withdrawals are owner drawings from equity and do NOT reduce operating profit.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 font-mono text-xs">
              <div className="text-muted-foreground">Total Owner / Family Drawings:</div>
              <div className="text-right font-bold text-amber-400 sm:col-span-2">
                {fmtRs(report.ownerDrawingsPaise)} ({fmtG(report.ownerDrawingsFineMg)} g Gold Equiv)
              </div>

              <div className="text-foreground font-bold border-t border-border pt-1">
                Net Retained Equity Added to Business:
              </div>
              <div className="text-right font-bold text-foreground border-t border-border pt-1 sm:col-span-2 text-sm">
                {fmtRs(report.netEquityImpactPaise)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
