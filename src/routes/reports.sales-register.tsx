import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchBillingInvoicesByDateRange } from "@/lib/billing-query";
import { compileSalesRegister, type SalesRegisterRow } from "@/lib/statutory-registers";
import { exportToCSV, fmtG, fmtRs, thisMonthRange, triggerPrint } from "@/lib/report-engine";
import { Download, Printer } from "lucide-react";

export const Route = createFileRoute("/reports/sales-register")({
  head: () => ({ meta: [{ title: "Sales Register · AVS ERP" }] }),
  component: SalesRegisterPage,
});

import { useSettings } from "@/lib/settings-store";

function SalesRegisterPage() {
  const month = thisMonthRange();
  const [from, setFrom] = useState(month.from);
  const [to, setTo] = useState(month.to);
  const [rows, setRows] = useState<SalesRegisterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [capped, setCapped] = useState(false);
  const [total, setTotal] = useState(0);
  const branding = useSettings((s) => s.branding);
  const firm = useSettings((s) => s.firm);
  const companyName = firm?.shopName || branding.companyName || "Ma Tara Jewellers";

  useEffect(() => {
    let cancelled = false;
    const fromMs = new Date(from).setHours(0, 0, 0, 0);
    const toMs = new Date(to).setHours(23, 59, 59, 999);
    setLoading(true);
    setError(null);
    void fetchBillingInvoicesByDateRange({ fromMs, toMs })
      .then(({ invoices, total: t, capped: c }) => {
        if (cancelled) return;
        setRows(compileSalesRegister(invoices, fromMs, toMs));
        setTotal(t);
        setCapped(c);
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setRows([]);
          setError(e.message || "Failed to load sales register");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          fineMg: acc.fineMg + row.fineMg,
          taxablePaise: acc.taxablePaise + row.taxablePaise,
          gstPaise: acc.gstPaise + row.cgstPaise + row.sgstPaise + row.igstPaise,
          tcsPaise: acc.tcsPaise + row.tcsPaise,
          grandPaise: acc.grandPaise + row.grandPaise,
        }),
        { fineMg: 0, taxablePaise: 0, gstPaise: 0, tcsPaise: 0, grandPaise: 0 },
      ),
    [rows],
  );

  function handleCSV() {
    exportToCSV("sales-register.csv", [
      [
        "Invoice",
        "Date",
        "Customer",
        "GSTIN",
        "HSN",
        "Fine Gold (g)",
        "Metal",
        "Making",
        "Stone",
        "Taxable",
        "CGST",
        "SGST",
        "IGST",
        "TCS",
        "Grand",
      ],
      ...rows.map((row) => [
        row.invoiceNo,
        new Date(row.dateMs).toLocaleDateString("en-IN"),
        row.customerName,
        row.gstin,
        row.hsn,
        fmtG(row.fineMg),
        fmtRs(row.metalPaise),
        fmtRs(row.makingPaise),
        fmtRs(row.stonePaise),
        fmtRs(row.taxablePaise),
        fmtRs(row.cgstPaise),
        fmtRs(row.sgstPaise),
        fmtRs(row.igstPaise),
        fmtRs(row.tcsPaise),
        fmtRs(row.grandPaise),
      ]),
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
            <h2 className="text-base font-bold text-black uppercase tracking-wider">Sales Register (Gold First)</h2>
            <p className="text-xs text-gray-600 font-medium">Period: {from} to {to}</p>
            <p className="text-[11px] font-bold text-black mt-1">
              Total Fine Gold Sold: {fmtG(totals.fineMg)}
            </p>
            <p className="text-[9px] text-gray-400">
              Printed on: {new Date().toLocaleString("en-IN")}
            </p>
          </div>
        </div>
      </div>

      <div className="print:hidden">
        <PageHeader
          title="Sales Register (Gold-First)"
          subtitle="Confirmed invoices in the period, with fine gold basis, metal / making split, GST, TCS, and HSN."
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
      </div>

      {/* Gold-First Summary Headline Card */}
      <div className="rounded-md border border-border print:border-black/30 bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Total Sales (Gold First)</div>
            <div className="text-2xl font-bold font-mono text-gold">{fmtG(totals.fineMg)} Fine Gold</div>
          </div>
          <div className="text-right text-xs text-muted-foreground font-mono space-y-0.5">
            <div>Taxable Value: <span className="font-semibold text-foreground">{fmtRs(totals.taxablePaise)}</span></div>
            <div>GST: <span className="font-semibold text-foreground">{fmtRs(totals.gstPaise)}</span> · TCS: <span className="font-semibold text-foreground">{fmtRs(totals.tcsPaise)}</span></div>
            <div className="text-sm font-bold text-foreground">Grand Total: {fmtRs(totals.grandPaise)}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-end print:hidden">
        <div className="space-y-1.5">
          <Label className="text-xs">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <p className="text-xs text-muted-foreground">
          {loading
            ? "Loading…"
            : `${rows.length} invoice(s)${capped ? ` of ${total} (capped)` : ""}`}
        </p>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="overflow-x-auto rounded-lg border print:border-black/30">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 print:bg-gray-100">
            <tr className="text-left text-muted-foreground print:text-black border-b">
              <th className="py-2.5 px-2">Invoice</th>
              <th className="py-2.5 px-2">Date</th>
              <th className="py-2.5 px-2">Customer</th>
              <th className="py-2.5 px-2">HSN</th>
              <th className="py-2.5 px-2 text-right font-bold text-gold print:text-black">Fine Gold (g)</th>
              <th className="py-2.5 px-2 text-right">Taxable</th>
              <th className="py-2.5 px-2 text-right">GST</th>
              <th className="py-2.5 px-2 text-right">TCS</th>
              <th className="py-2.5 px-2 text-right">Grand</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-6 text-center text-muted-foreground">
                  No confirmed invoices in this period.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.invoiceNo} className="border-b border-border/40">
                  <td className="py-1.5 px-2 font-mono text-gold">{row.invoiceNo}</td>
                  <td className="py-1.5 px-2">{new Date(row.dateMs).toLocaleDateString("en-IN")}</td>
                  <td className="py-1.5 px-2">{row.customerName}</td>
                  <td className="py-1.5 px-2 font-mono">{row.hsn}</td>
                  <td className="py-1.5 px-2 text-right font-mono font-bold text-gold">{fmtG(row.fineMg)}</td>
                  <td className="py-1.5 px-2 text-right font-mono">{fmtRs(row.taxablePaise)}</td>
                  <td className="py-1.5 px-2 text-right font-mono">
                    {fmtRs(row.cgstPaise + row.sgstPaise + row.igstPaise)}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono">{fmtRs(row.tcsPaise)}</td>
                  <td className="py-1.5 px-2 text-right font-mono font-semibold">{fmtRs(row.grandPaise)}</td>
                </tr>
              ))
            )}
            <tr className="border-t font-bold bg-muted/40 print:bg-gray-100">
              <td colSpan={4} className="py-2 px-2">Total</td>
              <td className="py-2 px-2 text-right font-mono text-gold">{fmtG(totals.fineMg)}</td>
              <td className="py-2 px-2 text-right font-mono">{fmtRs(totals.taxablePaise)}</td>
              <td className="py-2 px-2 text-right font-mono">{fmtRs(totals.gstPaise)}</td>
              <td className="py-2 px-2 text-right font-mono">{fmtRs(totals.tcsPaise)}</td>
              <td className="py-2 px-2 text-right font-mono">{fmtRs(totals.grandPaise)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
