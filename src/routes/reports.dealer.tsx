import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchDealerReportRows, type DealerReportRow } from "@/lib/party-report-query";
import { mgToGrams } from "@/lib/gold";
import { fmtRs, fmtDate, exportToCSV, triggerPrint } from "@/lib/report-engine";
import { AlertTriangle, Download, Loader2, Printer, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/reports/dealer")({
  head: () => ({ meta: [{ title: "Dealer Report · AVS Gold ERP" }] }),
  component: DealerReportPage,
});

/**
 * "Dealer" in this ERP is the bullion/metal supplier — modeled as
 * PersonType "vendor" (see people-store.ts) with settlement history in
 * gold-settlement-store.ts (party_type: "vendor"). No new entity or store —
 * this reuses the same running-balance snapshot (p_balance_gold_mg /
 * p_balance_cash_paise) each settlement already carries, the same figures a
 * dealer's own settlement history shows.
 */
function DealerReportPage() {
  const [rows, setRows] = useState<DealerReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [capped, setCapped] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchDealerReportRows()
      .then((data) => {
        if (cancelled) return;
        setRows(data.rows);
        setCapped(data.capped);
      })
      .catch((err) => {
        if (cancelled) return;
        setRows([]);
        setCapped(false);
        setError(err instanceof Error ? err.message : "Could not load dealer report.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function handleCSV() {
    const header = [
      "Dealer",
      "Transactions",
      "Gold Balance (g)",
      "Cash Balance",
      "Last Settlement",
    ];
    const data = rows.map((r) => [
      r.name,
      r.transactionCount,
      mgToGrams(r.goldBalanceMg),
      fmtRs(r.cashBalancePaise),
      r.lastSettlementDate ? fmtDate(new Date(r.lastSettlementDate).getTime()) : "Never",
    ]);
    exportToCSV("dealer-report.csv", [header, ...data]);
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Dealer Report"
        subtitle="Bullion/metal dealers (vendor-type parties): running gold/cash balance and settlement history"
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

      {loading ? (
        <div className="mt-4 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          Loading dealer balances...
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-destructive">Dealer report could not load</p>
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
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700">
          <AlertTriangle className="mr-2 inline h-4 w-4" />
          Showing a bounded Supabase report preview. Add aggregate/paginated dealer ledgers before
          high-volume audit sign-off.
        </div>
      ) : null}

      <div className="rounded-md border border-border bg-card overflow-hidden mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="dealer-report-table">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">Dealer</th>
                <th className="text-right p-3">Transactions</th>
                <th className="text-right p-3">Gold Balance</th>
                <th className="text-right p-3">Cash Balance</th>
                <th className="text-right p-3">Last Settlement</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-3">{r.name}</td>
                  <td className="p-3 text-right font-mono">{r.transactionCount}</td>
                  <td className="p-3 text-right font-mono">{mgToGrams(r.goldBalanceMg)}g</td>
                  <td className="p-3 text-right font-mono">{fmtRs(r.cashBalancePaise)}</td>
                  <td className="p-3 text-right">
                    {r.lastSettlementDate ? (
                      fmtDate(new Date(r.lastSettlementDate).getTime())
                    ) : (
                      <Badge variant="outline" className="border-amber-500/40 text-amber-400">
                        Never
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    No dealers (vendor-type parties) found.
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
