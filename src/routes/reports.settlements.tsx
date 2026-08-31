import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { previewSettlementTotals, type Settlement } from "@/lib/settlement-store";
import { fetchSettlementReportData } from "@/lib/delivery-summary-query";
import { fmtRs, fmtDate, exportToCSV, triggerPrint } from "@/lib/report-engine";
import { resolveNarrationForDisplay } from "@/lib/ledger-narration";
import { ReportShell } from "@/components/reports/ReportShell";
import { SourceOfTruthBadge } from "@/components/ledger/SourceOfTruthBadge";
import { AlertTriangle, Download, Loader2, Printer, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/reports/settlements")({
  head: () => ({ meta: [{ title: "Settlement Report · AVS ERP" }] }),
  component: SettlementReportPage,
});

const STATUS_LABELS: Record<string, string> = {
  pending_settlement: "Pending Settlement",
  partially_settled: "Partially Settled",
  credit_delivery: "Credit Delivery",
  settled: "Settled",
};

/**
 * Every Customer Settlement (draft or finalised), with the same total
 * previewSettlementTotals() computes on the Draft/Final screens themselves —
 * no separate total logic here, so this list can't disagree with what an
 * operator sees when opening any one settlement.
 */
function SettlementReportPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [capped, setCapped] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchSettlementReportData({ status: statusFilter })
      .then((data) => {
        if (cancelled) return;
        setSettlements(data.settlements);
        setCapped(data.capped);
      })
      .catch((err) => {
        if (cancelled) return;
        setSettlements([]);
        setCapped(false);
        setError(err instanceof Error ? err.message : "Could not load settlements.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [statusFilter, reloadKey]);

  const rows = useMemo(() => {
    return settlements
      .map((s) => ({
        s,
        totals: previewSettlementTotals(s.items, s.gst, s.payments),
        fineMg: s.items.reduce((sum, item) => sum + (item.fineMg || 0), 0),
      }))
      .sort((a, b) => b.s.createdAt - a.s.createdAt);
  }, [settlements]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of settlements) counts[s.financialStatus] = (counts[s.financialStatus] ?? 0) + 1;
    return counts;
  }, [settlements]);

  function handleCSV() {
    const header = ["Settlement No", "Date", "Customer", "Status", "Narration", "Fine Gold (g)", "Grand Total ₹", "Balance ₹", "Ledger"];
    const data = rows.map(({ s, totals, fineMg }) => [
      s.settlementNo,
      fmtDate(s.createdAt),
      s.customerName,
      STATUS_LABELS[s.financialStatus] ?? s.financialStatus,
      resolveNarrationForDisplay({
        notes: s.notes,
        description: s.dealerRemarks ?? s.employeeRemarks,
      }),
      (fineMg / 1000).toFixed(3),
      fmtRs(totals.grandTotalPaise),
      fmtRs(totals.balancePaise),
      s.goldSettlementId ?? s.linkedInvoiceId ?? "",
    ]);
    exportToCSV("settlement-report.csv", [header, ...data]);
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Settlement Report"
        subtitle="Every Customer Settlement, draft through finalised"
        actions={
          <div className="flex gap-2 items-center">
            <SourceOfTruthBadge variant="operational" />
            <Button variant="outline" size="sm" asChild>
              <Link to="/reports/settlement-reconciliation">Reconcile</Link>
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleCSV}>
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => triggerPrint()}>
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-1.5 mt-4 mb-4" data-testid="settlement-status-filter">
        {["all", "pending_settlement", "partially_settled", "credit_delivery", "settled"].map(
          (key) => (
            <Button
              key={key}
              size="sm"
              variant={statusFilter === key ? "default" : "outline"}
              onClick={() => setStatusFilter(key)}
            >
              {key === "all" ? "All" : STATUS_LABELS[key]}
              {key !== "all" && statusCounts[key] ? ` (${statusCounts[key]})` : ""}
            </Button>
          ),
        )}
      </div>

      {loading ? (
        <div className="mb-4 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          Loading customer settlements...
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-destructive">Settlement report could not load</p>
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
        </div>
      ) : null}

      {capped ? (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700">
          <AlertTriangle className="mr-2 inline h-4 w-4" />
          Showing the first 1000 matching settlements. Add paginated settlement reporting before
          using this as high-volume audit evidence.
        </div>
      ) : null}

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="settlement-report-table">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">Settlement No</th>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Customer</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Narration</th>
                <th className="text-right p-3">Fine Gold (g)</th>
                <th className="text-right p-3">Grand Total</th>
                <th className="text-right p-3">Balance</th>
                <th className="text-left p-3">Ledger</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ s, totals, fineMg }) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="p-3">
                    <Link
                      to="/settlement/$id"
                      params={{ id: s.id }}
                      className="text-gold hover:underline"
                    >
                      {s.settlementNo}
                    </Link>
                  </td>
                  <td className="p-3">{fmtDate(s.createdAt)}</td>
                  <td className="p-3">{s.customerName}</td>
                  <td className="p-3">
                    <Badge variant="outline">
                      {STATUS_LABELS[s.financialStatus] ?? s.financialStatus}
                    </Badge>
                  </td>
                  <td className="p-3 max-w-xs truncate text-muted-foreground">
                    {resolveNarrationForDisplay({
                      notes: s.notes,
                      description: s.dealerRemarks ?? s.employeeRemarks,
                    })}
                  </td>
                  <td className="p-3 text-right font-mono text-gold font-bold">
                    {(fineMg / 1000).toFixed(3)} g
                  </td>
                  <td className="p-3 text-right font-mono">{fmtRs(totals.grandTotalPaise)}</td>
                  <td className="p-3 text-right font-mono">{fmtRs(totals.balancePaise)}</td>
                  <td className="p-3 text-xs">
                    {s.goldSettlementId ? (
                      <Link
                        to="/billing/gold-settlement-print/$id"
                        params={{ id: s.goldSettlementId }}
                        className="text-primary hover:underline"
                      >
                        Gold voucher
                      </Link>
                    ) : s.linkedInvoiceId ? (
                      <Link to="/billing/$id" params={{ id: s.linkedInvoiceId }} className="text-primary hover:underline">
                        Invoice
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-muted-foreground">
                    No settlements found.
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
