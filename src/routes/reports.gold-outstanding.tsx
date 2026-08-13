import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/lib/settings-store";
import { mgToGrams } from "@/lib/gold";
import {
  fetchGoldOutstandingReport,
  type GoldOutstandingRow,
} from "@/lib/gold-summary-report-query";
import { exportToCSV, triggerPrint } from "@/lib/report-engine";
import { AlertTriangle, Download, Printer } from "lucide-react";

export const Route = createFileRoute("/reports/gold-outstanding")({
  head: () => ({ meta: [{ title: "Gold Outstanding Report · AVS Gold ERP" }] }),
  component: GoldOutstandingPage,
});

function GoldOutstandingPage() {
  const selectedBranchId = useSettings((s) => s.selectedBranchId);
  const [rows, setRows] = useState<GoldOutstandingRow[]>([]);
  const [capped, setCapped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const report = await fetchGoldOutstandingReport(selectedBranchId || null);
      setRows(report.rows);
      setCapped(report.capped);
    } catch {
      setError("Could not load gold outstanding report from Supabase.");
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalMg = rows.reduce((s, r) => s + Math.abs(r.outstandingMg), 0);
  const owedToUs = rows
    .filter((r) => r.outstandingMg > 0)
    .reduce((s, r) => s + Math.abs(r.outstandingMg), 0);
  const owedByUs = rows
    .filter((r) => r.outstandingMg < 0)
    .reduce((s, r) => s + Math.abs(r.outstandingMg), 0);

  function handleCSV() {
    const header = ["Source", "Name", "Reference", "Outstanding (g)"];
    const data = rows.map((r) => [r.source, r.name, r.reference, mgToGrams(r.outstandingMg)]);
    exportToCSV("gold-outstanding.csv", [header, ...data]);
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Gold Outstanding Report"
        subtitle="Every visible gram of gold currently outstanding across manufacturing bills and the worker gold book, traceable to its source."
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleCSV}
              disabled={loading || rows.length === 0}
            >
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => triggerPrint()}>
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>
        }
      />

      {loading && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 rounded-2xl border border-border bg-card animate-pulse"
              />
            ))}
          </div>
          <div className="h-56 rounded-2xl border border-border bg-card animate-pulse" />
        </div>
      )}

      {error && !loading && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-sm text-amber-700">
          <AlertTriangle className="mb-2 h-5 w-5" />
          {error}
          <button type="button" onClick={() => void load()} className="ml-3 underline">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          {capped && (
            <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700">
              Showing a bounded 1000-row report slice. Add dated server aggregates before using this
              as full-history statutory evidence.
            </div>
          )}

          <div className="grid sm:grid-cols-3 gap-3 mb-6">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                Total Outstanding
              </div>
              <div className="text-2xl font-mono font-bold">{mgToGrams(totalMg)} g</div>
            </div>
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                Owed To Us (Karigars/Workers hold)
              </div>
              <div className="text-2xl font-mono font-bold text-amber-600">
                {mgToGrams(owedToUs)} g
              </div>
            </div>
            <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                Owed By Us (Jama to karigars/workers)
              </div>
              <div className="text-2xl font-mono font-bold text-red-600">
                {mgToGrams(owedByUs)} g
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left">
                    <th className="p-3">Source</th>
                    <th className="p-3">Name</th>
                    <th className="p-3">Reference</th>
                    <th className="p-3 text-right">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-muted-foreground">
                        <AlertTriangle className="h-6 w-6 mx-auto mb-2 opacity-40" />
                        No outstanding gold anywhere. Everything is settled.
                      </td>
                    </tr>
                  )}
                  {rows.map((r, i) => (
                    <tr
                      key={`${r.source}-${r.reference}-${i}`}
                      className="border-b border-border last:border-0"
                    >
                      <td className="p-3">
                        <Badge variant="secondary">{r.source}</Badge>
                      </td>
                      <td className="p-3 font-medium">{r.name}</td>
                      <td className="p-3 text-muted-foreground">{r.reference}</td>
                      <td className="p-3 text-right font-mono">
                        <span className={r.outstandingMg > 0 ? "text-amber-600" : "text-red-600"}>
                          {mgToGrams(Math.abs(r.outstandingMg))} g
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
