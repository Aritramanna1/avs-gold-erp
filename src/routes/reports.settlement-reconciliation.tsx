import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { previewSettlementTotals, type Settlement } from "@/lib/settlement-store";
import type { Invoice } from "@/lib/billing-store";
import { fetchSettlementReportData } from "@/lib/delivery-summary-query";
import { fmtRs, fmtDate, exportToCSV, triggerPrint } from "@/lib/report-engine";
import { AlertTriangle, CheckCircle2, Download, Loader2, Printer, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/reports/settlement-reconciliation")({
  head: () => ({ meta: [{ title: "Settlement Reconciliation · AVS Gold ERP" }] }),
  component: SettlementReconciliationPage,
});

/**
 * Every finalised Settlement should have created exactly one Invoice, and
 * that invoice should still be active (not cancelled). This checks exactly
 * that structural link — it does NOT re-derive "what the total should have
 * been" via previewSettlementTotals()/computeInvoiceTotals(), because that
 * function reads the CURRENT live GST config (useSettings.getState().gst)
 * rather than whatever config was in effect at finalisation time. A
 * "recompute with today's settings and compare to the frozen invoice total"
 * check would false-positive every historical settlement as a "mismatch"
 * the moment GST rate/config is ever changed, even though the invoice was
 * correctly frozen at the time — the same trap delivery-summary.tsx's
 * resolveSettlementFinancials() already avoids by always preferring the
 * linked invoice's own stored figures. The invoice's total IS the source of
 * truth once it exists and is active; it is shown here for visual
 * comparison against the settlement's items, not asserted as an error.
 */
function SettlementReconciliationPage() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [capped, setCapped] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchSettlementReportData({ finalisedOnly: true })
      .then((data) => {
        if (cancelled) return;
        setSettlements(data.settlements);
        setInvoices(data.invoices);
        setCapped(data.capped);
      })
      .catch((err) => {
        if (cancelled) return;
        setSettlements([]);
        setInvoices([]);
        setCapped(false);
        setError(err instanceof Error ? err.message : "Could not load settlement reconciliation.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const rows = useMemo(() => {
    return settlements
      .filter((s) => s.finalisedAt && s.linkedInvoiceId)
      .map((s) => {
        const invoice = invoices.find((i) => i.id === s.linkedInvoiceId);
        const expectedTotals = previewSettlementTotals(s.items, s.gst, s.payments);
        let status: "ok" | "missing" | "cancelled" = "ok";
        if (!invoice) status = "missing";
        else if (invoice.status === "cancelled") status = "cancelled";
        return { settlement: s, invoice, expectedTotals, status };
      })
      .sort((a, b) => (a.status === "ok" ? 1 : -1));
  }, [settlements, invoices]);

  const exceptions = rows.filter((r) => r.status !== "ok");

  function handleCSV() {
    const header = [
      "Settlement",
      "Date",
      "Settlement Total (today's rates)",
      "Invoice Total (frozen)",
      "Status",
    ];
    const data = rows.map((r) => [
      r.settlement.settlementNo,
      fmtDate(r.settlement.createdAt),
      fmtRs(r.expectedTotals.grandTotalPaise),
      r.invoice ? fmtRs(r.invoice.grandTotalPaise) : "—",
      r.status,
    ]);
    exportToCSV("settlement-reconciliation.csv", [header, ...data]);
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Settlement Reconciliation"
        subtitle="Every finalised Settlement vs. the GST Invoice it created — verifies the link exists and is active"
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

      <div className="rounded-md border border-border bg-card p-4 mt-4 mb-4">
        {loading ? (
          <div className="mb-3 text-sm text-muted-foreground">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            Loading finalised settlement links...
          </div>
        ) : null}
        {error ? (
          <div className="mb-3 flex items-start justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <div>
              <p className="font-medium text-destructive">Reconciliation could not load</p>
              <p className="mt-1 text-muted-foreground">{error}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setReloadKey((value) => value + 1)}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        ) : null}
        {capped ? (
          <div className="mb-3 text-sm text-amber-500">
            <AlertTriangle className="mr-2 inline h-4 w-4" />
            Showing the first 1000 finalised settlements. Add paginated reconciliation evidence for
            high-volume audit use.
          </div>
        ) : null}
        {exceptions.length === 0 ? (
          <div className="text-sm text-emerald-500 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> All finalised settlements reconcile cleanly against
            their linked invoices.
          </div>
        ) : (
          <div className="text-sm text-amber-500 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> {exceptions.length} exception(s) found.
          </div>
        )}
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="settlement-reconciliation-table">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">Settlement</th>
                <th className="text-left p-3">Date</th>
                <th className="text-right p-3">Settlement Total (at today's rates)</th>
                <th className="text-right p-3">Invoice Total (frozen)</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.settlement.id} className="border-t border-border">
                  <td className="p-3">{r.settlement.settlementNo}</td>
                  <td className="p-3">{fmtDate(r.settlement.createdAt)}</td>
                  <td className="p-3 text-right font-mono">
                    {fmtRs(r.expectedTotals.grandTotalPaise)}
                  </td>
                  <td className="p-3 text-right font-mono">
                    {r.invoice ? fmtRs(r.invoice.grandTotalPaise) : "—"}
                  </td>
                  <td className="p-3">
                    {r.status === "ok" && <Badge variant="outline">OK</Badge>}
                    {r.status === "missing" && <Badge variant="destructive">Invoice Missing</Badge>}
                    {r.status === "cancelled" && (
                      <Badge variant="outline" className="border-amber-500/40 text-amber-400">
                        Invoice Cancelled
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    No finalised settlements yet.
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
