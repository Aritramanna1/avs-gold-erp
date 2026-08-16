import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { fetchWorkerReportRows, type WorkerReportRow } from "@/lib/party-report-query";
import { mgToGrams } from "@/lib/gold";
import { exportToCSV, triggerPrint } from "@/lib/report-engine";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Download, Loader2, Printer, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/reports/worker")({
  head: () => ({ meta: [{ title: "Worker Report · AVS Gold ERP" }] }),
  component: WorkerReportPage,
});

/**
 * Per-karigar rollup — reuses each source's own canonical computation
 * (getWorkerBalance() for gold book, settlements filtered by partyId) rather
 * than recomputing balances here, so this can never disagree with the
 * Worker Gold Book or Settlement screens themselves.
 */
function WorkerReportPage() {
  const [rows, setRows] = useState<WorkerReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [capped, setCapped] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchWorkerReportRows()
      .then((data) => {
        if (cancelled) return;
        setRows(data.rows);
        setCapped(data.capped);
      })
      .catch((err) => {
        if (cancelled) return;
        setRows([]);
        setCapped(false);
        setError(err instanceof Error ? err.message : "Could not load worker report.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function handleCSV() {
    const header = ["Worker", "Pending Gold (g)", "Pending Qty", "Last Settlement"];
    const data = rows.map((r) => [
      r.name,
      mgToGrams(r.pendingFineMg),
      r.pendingQty,
      r.lastSettlementDate ? new Date(r.lastSettlementDate).toLocaleDateString("en-IN") : "Never",
    ]);
    exportToCSV("worker-report.csv", [header, ...data]);
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Worker Report"
        subtitle="Per-karigar pending gold, materials, and settlement status"
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
          Loading worker balances...
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-destructive">Worker report could not load</p>
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
          Showing a bounded Supabase report preview. Add full-history worker-balance aggregate/RPC
          before high-volume audit sign-off.
        </div>
      ) : null}

      <div className="rounded-md border border-border bg-card overflow-hidden mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="worker-report-table">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">Worker</th>
                <th className="text-right p-3">Pending Gold</th>
                <th className="text-right p-3">Pending Qty</th>
                <th className="text-right p-3">Last Settlement</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-3">{r.name}</td>
                  <td className="p-3 text-right font-mono">{mgToGrams(r.pendingFineMg)}g</td>
                  <td className="p-3 text-right font-mono">{r.pendingQty}</td>
                  <td className="p-3 text-right">
                    {r.lastSettlementDate ? (
                      new Date(r.lastSettlementDate).toLocaleDateString("en-IN")
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
                  <td colSpan={4} className="p-6 text-center text-muted-foreground">
                    No workers found.
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
