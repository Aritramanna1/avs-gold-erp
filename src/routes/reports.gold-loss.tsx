import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettings } from "@/lib/settings-store";
import { mgToGrams } from "@/lib/gold";
import {
  fetchGoldLossReport,
  type GoldLossProcess,
  type GoldLossReportResult,
} from "@/lib/gold-loss-report-query";
import { exportToCSV, triggerPrint } from "@/lib/report-engine";
import { AlertTriangle, Download, Printer, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/reports/gold-loss")({
  head: () => ({ meta: [{ title: "Gold Loss Report · AVS ERP" }] }),
  component: GoldLossReportPage,
});

function defaultFrom(): string {
  const d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function defaultTo(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function GoldLossReportPage() {
  const selectedBranchId = useSettings((s) => s.selectedBranchId);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [processFilter, setProcessFilter] = useState<"all" | GoldLossProcess>("all");
  const [report, setReport] = useState<GoldLossReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(
        await fetchGoldLossReport({
          from,
          to,
          branchId: selectedBranchId || null,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load gold loss report.");
    } finally {
      setLoading(false);
    }
  }, [from, to, selectedBranchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleRows = useMemo(() => {
    if (!report) return [];
    if (processFilter === "all") return report.rows;
    return report.rows.filter((r) => r.process === processFilter);
  }, [report, processFilter]);

  const visibleTotalMg = useMemo(
    () => visibleRows.reduce((sum, r) => sum + r.lossMg, 0),
    [visibleRows],
  );

  function handleCSV() {
    if (!report) return;
    exportToCSV(`gold-loss-${from}-to-${to}.csv`, [
      ["Date", "Process", "Person", "Grams lost", "Reference", "Notes", "Source"],
      ...visibleRows.map((r) => [
        formatDate(r.dateIso),
        r.process,
        r.person,
        mgToGrams(r.lossMg),
        r.reference,
        r.notes,
        r.source,
      ]),
      [],
      ["Total (g)", "", "", mgToGrams(visibleTotalMg), "", "", ""],
    ]);
  }

  async function handlePrint() {
    await triggerPrint("Gold Loss Report", { from, to });
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Gold Loss Report"
        subtitle="Process and person loss from manufacturing, workshop, melt, conversion, and the gold ledger — no parallel books."
        actions={
          <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 min-h-[var(--touch-target)]"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 min-h-[var(--touch-target)]"
              onClick={handleCSV}
              disabled={loading}
            >
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 min-h-[var(--touch-target)]"
              onClick={() => void handlePrint()}
              disabled={loading}
            >
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3 items-end">
        <div className="grid gap-1">
          <label className="text-xs text-muted-foreground">From</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="grid gap-1">
          <label className="text-xs text-muted-foreground">To</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        <div className="grid gap-1">
          <label className="text-xs text-muted-foreground">Process</label>
          <select
            value={processFilter}
            onChange={(e) => setProcessFilter(e.target.value as "all" | GoldLossProcess)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[var(--touch-target)]"
          >
            <option value="all">All processes</option>
            <option value="Manufacturing">Manufacturing</option>
            <option value="Overloss">Overloss</option>
            <option value="Melt">Melt</option>
            <option value="Workshop">Workshop</option>
            <option value="Conversion">Conversion</option>
            <option value="Ledger">Other ledger</option>
          </select>
        </div>
      </div>

      {!loading && (
        <>
          {error ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-6 text-sm text-amber-700 mb-4 no-print">
              <AlertTriangle className="mb-2 h-5 w-5 inline" />
              {error}
              <button type="button" onClick={() => void load()} className="ml-3 underline">
                Retry
              </button>
            </div>
          ) : null}

          <div data-testid="report-print-source">
          {report?.capped ? (
            <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 no-print">
              Showing the latest {REPORT_HINT} loss events in range. Narrow dates for a full statutory
              extract.
            </div>
          ) : null}

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <StatCard label="Total lost" valueMg={visibleTotalMg} accent="text-red-600" />
            {(
              [
                "Manufacturing",
                "Overloss",
                "Melt",
                "Workshop",
                "Conversion",
              ] as GoldLossProcess[]
            ).map((p) => (
              <StatCard
                key={p}
                label={p}
                valueMg={
                  processFilter === "all"
                    ? (report?.byProcess[p] ?? 0)
                    : processFilter === p
                      ? visibleTotalMg
                      : 0
                }
              />
            ))}
          </div>

          <div className="overflow-x-auto rounded-md border border-border bg-card">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 whitespace-nowrap">Date</th>
                  <th className="px-3 py-2 whitespace-nowrap">Process</th>
                  <th className="px-3 py-2 whitespace-nowrap">Person</th>
                  <th className="px-3 py-2 whitespace-nowrap text-right">Grams lost</th>
                  <th className="px-3 py-2 whitespace-nowrap">Reference</th>
                  <th className="px-3 py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                      No gold loss recorded in this range.
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((r) => (
                    <tr key={r.id} className="border-b border-border/60 hover:bg-muted/20">
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(r.dateIso)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Badge variant="outline">{r.process}</Badge>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap max-w-[160px] truncate" title={r.person}>
                        {r.person}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right font-mono text-red-600">
                        {mgToGrams(r.lossMg)}
                      </td>
                      <td
                        className="px-3 py-2 whitespace-nowrap max-w-[140px] truncate font-mono text-xs"
                        title={r.reference}
                      >
                        {r.reference}
                      </td>
                      <td className="px-3 py-2 max-w-[280px] truncate text-muted-foreground" title={r.notes}>
                        {r.notes}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {visibleRows.length > 0 && (
                <tfoot>
                  <tr className="bg-muted/30 font-semibold">
                    <td className="px-3 py-2" colSpan={3}>
                      Total ({visibleRows.length} rows)
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-red-700">
                      {mgToGrams(visibleTotalMg)} g
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          </div>
        </>
      )}

      {loading && (
        <div className="space-y-3">
          <div className="grid sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 rounded-md border border-border bg-card animate-pulse" />
            ))}
          </div>
          <div className="h-64 rounded-md border border-border bg-card animate-pulse" />
        </div>
      )}
    </div>
  );
}

const REPORT_HINT = 1000;

function StatCard({
  label,
  valueMg,
  accent,
}: {
  label: string;
  valueMg: number;
  accent?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <div className={`mt-1 font-mono text-lg ${accent ?? ""}`}>{mgToGrams(valueMg)} g</div>
    </div>
  );
}
