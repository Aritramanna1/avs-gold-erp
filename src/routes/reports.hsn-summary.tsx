import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBilling } from "@/lib/billing-store";
import { compileHsnSummary } from "@/lib/statutory-registers";
import { exportToCSV, fmtRs, thisMonthRange, triggerPrint } from "@/lib/report-engine";
import { Download, Printer } from "lucide-react";

export const Route = createFileRoute("/reports/hsn-summary")({
  head: () => ({ meta: [{ title: "HSN Summary · AVS ERP" }] }),
  component: HsnSummaryPage,
});

function HsnSummaryPage() {
  const invoices = useBilling((s) => s.invoices);
  const month = thisMonthRange();
  const [from, setFrom] = useState(month.from);
  const [to, setTo] = useState(month.to);

  const rows = useMemo(() => {
    const fromMs = new Date(from).setHours(0, 0, 0, 0);
    const toMs = new Date(to).setHours(23, 59, 59, 999);
    return compileHsnSummary(invoices, fromMs, toMs);
  }, [invoices, from, to]);

  function handleCSV() {
    exportToCSV("hsn-summary.csv", [
      ["HSN", "Invoices", "Taxable", "IGST", "CGST", "SGST"],
      ...rows.map((row) => [
        row.hsn,
        row.invoiceCount,
        fmtRs(row.taxablePaise),
        fmtRs(row.igstPaise),
        fmtRs(row.cgstPaise),
        fmtRs(row.sgstPaise),
      ]),
    ]);
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="HSN Summary"
        subtitle="GSTR-1 Table 12 style rollup. Ready-stock uses jewellery HSN; job-work uses SAC 9988 unless a line HSN is set."
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
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-muted-foreground border-b">
            <th className="py-2">HSN / SAC</th>
            <th className="py-2 text-right">Invoices</th>
            <th className="py-2 text-right">Taxable</th>
            <th className="py-2 text-right">IGST</th>
            <th className="py-2 text-right">CGST</th>
            <th className="py-2 text-right">SGST</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-6 text-muted-foreground">
                No confirmed invoices in this period.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.hsn} className="border-b border-border/40">
                <td className="py-1.5 font-mono">{row.hsn}</td>
                <td className="py-1.5 text-right font-mono">{row.invoiceCount}</td>
                <td className="py-1.5 text-right font-mono">{fmtRs(row.taxablePaise)}</td>
                <td className="py-1.5 text-right font-mono">{fmtRs(row.igstPaise)}</td>
                <td className="py-1.5 text-right font-mono">{fmtRs(row.cgstPaise)}</td>
                <td className="py-1.5 text-right font-mono">{fmtRs(row.sgstPaise)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
