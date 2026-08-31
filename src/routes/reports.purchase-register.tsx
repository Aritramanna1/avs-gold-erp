import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSupplierPurchases } from "@/lib/supplier-purchases-store";
import { compilePurchaseRegister } from "@/lib/statutory-registers";
import { exportToCSV, fmtG, fmtRs, thisMonthRange, triggerPrint } from "@/lib/report-engine";
import { Download, Printer } from "lucide-react";

export const Route = createFileRoute("/reports/purchase-register")({
  head: () => ({ meta: [{ title: "Purchase Register · AVS ERP" }] }),
  component: PurchaseRegisterPage,
});

function PurchaseRegisterPage() {
  const purchases = useSupplierPurchases((s) => s.purchases);
  const loading = useSupplierPurchases((s) => s.loading);
  const refresh = useSupplierPurchases((s) => s.refresh);
  const month = thisMonthRange();
  const [from, setFrom] = useState(month.from);
  const [to, setTo] = useState(month.to);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const rows = useMemo(() => {
    const fromMs = new Date(from).setHours(0, 0, 0, 0);
    const toMs = new Date(to).setHours(23, 59, 59, 999);
    return compilePurchaseRegister(purchases, fromMs, toMs);
  }, [purchases, from, to]);

  function handleCSV() {
    exportToCSV("purchase-register.csv", [
      ["Purchase", "Invoice", "Date", "Supplier", "Fine g", "Subtotal", "GST", "Total", "Paid", "Due"],
      ...rows.map((row) => [
        row.purchaseNo,
        row.invoiceNo,
        new Date(row.dateMs).toLocaleDateString("en-IN"),
        row.supplierId,
        fmtG(row.fineMg),
        fmtRs(row.subtotalPaise),
        fmtRs(row.gstPaise),
        fmtRs(row.totalPaise),
        fmtRs(row.paidPaise),
        fmtRs(row.duePaise),
      ]),
    ]);
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Purchase Register"
        subtitle="Supplier goods receipts in the period. Reversed purchases are excluded."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={handleCSV} disabled={rows.length === 0}>
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => triggerPrint()}>
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>
        }
      />
      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-1.5">
          <Label className="text-xs">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading purchases…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-2">Purchase</th>
                <th className="py-2">Invoice</th>
                <th className="py-2">Date</th>
                <th className="py-2">Supplier</th>
                <th className="py-2 text-right">Fine</th>
                <th className="py-2 text-right">Subtotal</th>
                <th className="py-2 text-right">GST</th>
                <th className="py-2 text-right">Total</th>
                <th className="py-2 text-right">Due</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-6 text-muted-foreground">
                    No supplier purchases in this period.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.purchaseNo} className="border-b border-border/40">
                    <td className="py-1.5 font-mono">{row.purchaseNo}</td>
                    <td className="py-1.5 font-mono">{row.invoiceNo}</td>
                    <td className="py-1.5">{new Date(row.dateMs).toLocaleDateString("en-IN")}</td>
                    <td className="py-1.5 font-mono">{row.supplierId}</td>
                    <td className="py-1.5 text-right font-mono">{fmtG(row.fineMg)}</td>
                    <td className="py-1.5 text-right font-mono">{fmtRs(row.subtotalPaise)}</td>
                    <td className="py-1.5 text-right font-mono">{fmtRs(row.gstPaise)}</td>
                    <td className="py-1.5 text-right font-mono">{fmtRs(row.totalPaise)}</td>
                    <td className="py-1.5 text-right font-mono">{fmtRs(row.duePaise)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
