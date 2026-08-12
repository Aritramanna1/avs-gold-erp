import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FileDown, Receipt } from "lucide-react";
import { toast } from "sonner";
import { useBilling } from "@/lib/billing-store";
import { useSettings } from "@/lib/settings-store";
import {
  generateGSTR1CSV,
  generateGSTR1B2CSummaryCSV,
  generateGSTR3BCSV,
  summarizeGSTR3B,
} from "@/lib/gst-return-engine";

export const Route = createFileRoute("/reports/gst-returns")({
  head: () => ({ meta: [{ title: "GST Returns · AVS Gold ERP" }] }),
  component: GstReturnsPage,
});

function toDateInputValue(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function GstReturnsPage() {
  const invoices = useBilling((s) => s.invoices);
  const firm = useSettings((s) => s.firm);
  const sellerStateCode = firm?.gstin ? firm.gstin.slice(0, 2) : "";
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const [from, setFrom] = useState(toDateInputValue(monthStart.getTime()));
  const [to, setTo] = useState(toDateInputValue(today.getTime()));

  const periodInvoices = useMemo(() => {
    const fromMs = new Date(from).setHours(0, 0, 0, 0);
    const toMs = new Date(to).setHours(23, 59, 59, 999);
    return invoices.filter((inv) => inv.createdAt >= fromMs && inv.createdAt <= toMs);
  }, [invoices, from, to]);

  const b2bCount = periodInvoices.filter(
    (inv) => inv.status !== "cancelled" && inv.customerGstin,
  ).length;
  const b2cCount = periodInvoices.filter(
    (inv) => inv.status !== "cancelled" && !inv.customerGstin,
  ).length;
  const summary = useMemo(
    () => summarizeGSTR3B(periodInvoices, `${from} to ${to}`),
    [periodInvoices, from, to],
  );

  function exportGSTR1() {
    if (b2bCount === 0) {
      toast.error("No B2B invoices (with customer GSTIN) in this date range.");
      return;
    }
    downloadCsv(generateGSTR1CSV(periodInvoices), `GSTR1_B2B_${from}_to_${to}.csv`);
    toast.success(`Exported ${b2bCount} B2B invoice(s).`);
  }
  function exportGSTR1B2C() {
    if (b2cCount === 0) {
      toast.error("No B2C invoices (without customer GSTIN) in this date range.");
      return;
    }
    downloadCsv(
      generateGSTR1B2CSummaryCSV(periodInvoices, sellerStateCode),
      `GSTR1_B2CS_${from}_to_${to}.csv`,
    );
    toast.success(`Exported B2C summary from ${b2cCount} invoice(s).`);
  }
  function exportGSTR3B() {
    if (summary.invoiceCount === 0) {
      toast.error("No confirmed invoices in this date range.");
      return;
    }
    downloadCsv(generateGSTR3BCSV(summary), `GSTR3B_Summary_${from}_to_${to}.csv`);
    toast.success("GSTR-3B summary exported.");
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Receipt className="h-6 w-6 text-amber-600" />
          GST Returns
        </h1>
        <p className="text-sm text-muted-foreground">
          GSTR-1 (B2B outward supplies) and GSTR-3B (monthly summary) exports built from confirmed
          invoices in this period, formatted for the GST portal offline utility.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Period</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">GSTR-1 · B2B Invoices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{b2bCount} B2B invoice(s) in period.</p>
            <Button onClick={exportGSTR1} className="gap-2">
              <FileDown className="h-4 w-4" /> Export GSTR-1 CSV
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">GSTR-1 · B2CS Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {b2cCount} B2C invoice(s) in period, grouped by state + rate.
            </p>
            <Button onClick={exportGSTR1B2C} className="gap-2">
              <FileDown className="h-4 w-4" /> Export B2CS CSV
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">GSTR-3B · Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Taxable value</span>
                <span>₹{(summary.totalTaxableValuePaise / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">CGST</span>
                <span>₹{(summary.totalCgstPaise / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">SGST</span>
                <span>₹{(summary.totalSgstPaise / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IGST</span>
                <span>₹{(summary.totalIgstPaise / 100).toFixed(2)}</span>
              </div>
            </div>
            <Button onClick={exportGSTR3B} className="gap-2 mt-2">
              <FileDown className="h-4 w-4" /> Export GSTR-3B CSV
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
