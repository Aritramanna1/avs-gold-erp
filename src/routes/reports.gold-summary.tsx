import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/lib/settings-store";
import { mgToGrams } from "@/lib/gold";
import {
  fetchGoldSummaryReport,
  type GoldSummaryReportResult,
} from "@/lib/gold-summary-report-query";
import { exportToCSV, triggerPrint } from "@/lib/report-engine";
import { saveReportSnapshot } from "@/lib/report-snapshot";
import { AlertTriangle, Coins, Download, Printer, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reports/gold-summary")({
  head: () => ({ meta: [{ title: "Manufacturing Gold Summary · AVS Gold ERP" }] }),
  component: GoldSummaryPage,
});

function GoldSummaryPage() {
  const selectedBranchId = useSettings((s) => s.selectedBranchId);
  const [report, setReport] = useState<GoldSummaryReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await fetchGoldSummaryReport(selectedBranchId || null));
    } catch {
      setError("Could not load manufacturing gold summary from Supabase.");
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    void load();
  }, [load]);

  function handleCSV() {
    if (!report) return;
    exportToCSV("manufacturing-gold-summary.csv", [
      ["Dealer / Karigar Gold Position"],
      [
        "Karigar",
        "Gold Issued (g)",
        "Finished Returned (g)",
        "Scrap Returned (g)",
        "Filings Returned (g)",
        "Wastage (g)",
        "Outstanding Gold (g)",
      ],
      ...report.custody.map((c) => [
        c.karigarName,
        mgToGrams(c.issuedMg),
        mgToGrams(c.finishedMg),
        mgToGrams(c.scrapMg),
        mgToGrams(c.filingsMg),
        mgToGrams(c.wastageMg),
        mgToGrams(c.outstandingMg),
      ]),
      [],
      ["Manufacturing Bills - Gold Outstanding"],
      [
        "Bill No",
        "Karigar",
        "Gold Required (g)",
        "Gold Returned (g)",
        "Wastage (g)",
        "Outstanding Gold (g)",
      ],
      ...report.bills
        .filter((b) => b.outstandingMg !== 0)
        .map((b) => [
          b.billNo,
          b.karigarName,
          mgToGrams(b.issuedMg),
          mgToGrams(b.returnedMg),
          mgToGrams(b.wastageMg),
          mgToGrams(b.outstandingMg),
        ]),
    ]);
  }

  async function handleSaveSnapshot() {
    if (!report) return;
    setSaving(true);
    try {
      await saveReportSnapshot({
        reportType: "gold-summary",
        branchId: selectedBranchId || null,
        params: { branchId: selectedBranchId || null },
        computedRows: { bills: report.bills, custody: report.custody },
        totals: report.totals,
      });
      toast.success("Report snapshot saved as verified.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save report snapshot.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Manufacturing Gold Summary"
        subtitle="Gold is the primary accounting unit. Every figure below is fine gold, not cash."
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleSaveSnapshot}
              disabled={!report || saving}
            >
              <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save as Verified"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleCSV}
              disabled={!report}
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
          <div className="grid sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 rounded-md border border-border bg-card animate-pulse" />
            ))}
          </div>
          <div className="h-64 rounded-md border border-border bg-card animate-pulse" />
        </div>
      )}

      {error && !loading && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-6 text-sm text-amber-700">
          <AlertTriangle className="mb-2 h-5 w-5" />
          {error}
          <button type="button" onClick={() => void load()} className="ml-3 underline">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && report && (
        <>
          {report.capped && (
            <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700">
              Showing the latest 1000 manufacturing bills. Narrow by branch or add a dated aggregate
              export before using this as a statutory full-history report.
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <GoldStatCard
              label="Total Gold Required"
              value={report.totals.required}
              color="text-blue-500"
            />
            <GoldStatCard
              label="Total Gold Returned"
              value={report.totals.returned}
              color="text-emerald-500"
            />
            <GoldStatCard
              label="Total Wastage"
              value={report.totals.wastage}
              color="text-amber-500"
            />
            <GoldStatCard
              label="Net Outstanding Gold"
              value={Math.abs(report.totals.outstanding)}
              color={
                report.totals.outstanding === 0
                  ? "text-emerald-500"
                  : report.totals.outstanding > 0
                    ? "text-amber-500"
                    : "text-red-500"
              }
              sub={
                report.totals.outstanding === 0
                  ? "Settled"
                  : report.totals.outstanding > 0
                    ? "Jama (owed to karigars)"
                    : "Udhar (owed by karigars)"
              }
            />
          </div>

          <div className="flex items-center gap-2 mb-3">
            <Coins className="h-4 w-4 text-gold" />
            <h2 className="font-serif text-lg">Dealer / Karigar Gold Position</h2>
          </div>
          {/* Mobile view */}
          <div className="block md:hidden space-y-3 mb-8">
            {report.custody.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground italic text-xs bg-card rounded-md border border-border">
                No karigar gold custody data yet.
              </div>
            ) : (
              report.custody.map((c) => (
                <div
                  key={c.karigarId}
                  className="rounded-md border border-border bg-card p-4 space-y-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{c.karigarName}</span>
                    <Badge variant={c.outstandingMg === 0 ? "secondary" : "destructive"}>
                      Outstanding: {mgToGrams(Math.abs(c.outstandingMg))} g
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                    <div>
                      <span className="text-[9px] text-muted-foreground block font-sans">
                        Issued
                      </span>
                      <span>{mgToGrams(c.issuedMg)}g</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-muted-foreground block font-sans">
                        Finished
                      </span>
                      <span>{mgToGrams(c.finishedMg)}g</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-muted-foreground block font-sans">
                        Scrap
                      </span>
                      <span>{mgToGrams(c.scrapMg)}g</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-muted-foreground block font-sans">
                        Filings
                      </span>
                      <span>{mgToGrams(c.filingsMg)}g</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-muted-foreground block font-sans">
                        Wastage
                      </span>
                      <span className="text-amber-600 font-semibold">
                        {mgToGrams(c.wastageMg)}g
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop view */}
          <div className="hidden md:block rounded-md border border-border bg-card overflow-hidden mb-8">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left">
                    <th className="p-3">Karigar</th>
                    <th className="p-3 text-right">Gold Issued</th>
                    <th className="p-3 text-right">Finished Returned</th>
                    <th className="p-3 text-right">Scrap Returned</th>
                    <th className="p-3 text-right">Filings Returned</th>
                    <th className="p-3 text-right">Wastage</th>
                    <th className="p-3 text-right">Outstanding Gold</th>
                  </tr>
                </thead>
                <tbody>
                  {report.custody.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        No karigar gold custody data yet.
                      </td>
                    </tr>
                  )}
                  {report.custody.map((c) => (
                    <tr key={c.karigarId} className="border-b border-border last:border-0">
                      <td className="p-3 font-medium">{c.karigarName}</td>
                      <td className="p-3 text-right font-mono">{mgToGrams(c.issuedMg)}</td>
                      <td className="p-3 text-right font-mono">{mgToGrams(c.finishedMg)}</td>
                      <td className="p-3 text-right font-mono">{mgToGrams(c.scrapMg)}</td>
                      <td className="p-3 text-right font-mono">{mgToGrams(c.filingsMg)}</td>
                      <td className="p-3 text-right font-mono text-amber-600">
                        {mgToGrams(c.wastageMg)}
                      </td>
                      <td className="p-3 text-right font-mono">
                        <Badge variant={c.outstandingMg === 0 ? "secondary" : "destructive"}>
                          {mgToGrams(Math.abs(c.outstandingMg))} g
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <Coins className="h-4 w-4 text-gold" />
            <h2 className="font-serif text-lg">Manufacturing Bills - Gold Outstanding</h2>
          </div>
          {/* Mobile view */}
          <div className="block md:hidden space-y-3">
            {report.bills.filter((b) => b.outstandingMg !== 0).length === 0 ? (
              <div className="p-8 text-center text-muted-foreground italic text-xs bg-card rounded-md border border-border">
                Every manufacturing bill is fully settled in gold. No outstanding balances.
              </div>
            ) : (
              report.bills
                .filter((b) => b.outstandingMg !== 0)
                .sort((a, b) => Math.abs(b.outstandingMg) - Math.abs(a.outstandingMg))
                .map((b) => (
                  <div
                    key={b.id}
                    className="rounded-md border border-border bg-card p-4 space-y-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{b.billNo}</span>
                      <span
                        className={
                          b.outstandingMg > 0
                            ? "text-amber-600 font-semibold font-mono"
                            : "text-red-600 font-semibold font-mono"
                        }
                      >
                        {b.outstandingMg > 0 ? "Jama: " : "Owed: "}
                        {mgToGrams(Math.abs(b.outstandingMg))} g
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Karigar:{" "}
                      <span className="font-semibold text-foreground">{b.karigarName}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px] font-mono bg-muted/20 p-2 rounded-lg text-center">
                      <div>
                        <span className="text-[9px] text-muted-foreground block font-sans">
                          Required
                        </span>
                        <span>{mgToGrams(b.issuedMg)}g</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-muted-foreground block font-sans">
                          Returned
                        </span>
                        <span>{mgToGrams(b.returnedMg)}g</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-muted-foreground block font-sans">
                          Wastage
                        </span>
                        <span className="text-amber-600 font-semibold">
                          {mgToGrams(b.wastageMg)}g
                        </span>
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>

          {/* Desktop view */}
          <div className="hidden md:block rounded-md border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left">
                    <th className="p-3">Bill No</th>
                    <th className="p-3">Karigar</th>
                    <th className="p-3 text-right">Gold Required</th>
                    <th className="p-3 text-right">Gold Returned</th>
                    <th className="p-3 text-right">Wastage</th>
                    <th className="p-3 text-right">Outstanding Gold</th>
                  </tr>
                </thead>
                <tbody>
                  {report.bills
                    .filter((b) => b.outstandingMg !== 0)
                    .sort((a, b) => Math.abs(b.outstandingMg) - Math.abs(a.outstandingMg))
                    .map((b) => (
                      <tr key={b.id} className="border-b border-border last:border-0">
                        <td className="p-3">{b.billNo}</td>
                        <td className="p-3">{b.karigarName}</td>
                        <td className="p-3 text-right font-mono">{mgToGrams(b.issuedMg)}</td>
                        <td className="p-3 text-right font-mono">{mgToGrams(b.returnedMg)}</td>
                        <td className="p-3 text-right font-mono text-amber-600">
                          {mgToGrams(b.wastageMg)}
                        </td>
                        <td className="p-3 text-right font-mono">
                          <span className={b.outstandingMg > 0 ? "text-amber-600" : "text-red-600"}>
                            {mgToGrams(Math.abs(b.outstandingMg))} g
                          </span>
                        </td>
                      </tr>
                    ))}
                  {report.bills.every((b) => b.outstandingMg === 0) && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        Every manufacturing bill is fully settled in gold. No outstanding balances.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function GoldStatCard({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: number;
  color: string;
  sub?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
        {label}
      </div>
      <div className={`text-2xl font-mono font-bold ${color}`}>{mgToGrams(value)} g</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
