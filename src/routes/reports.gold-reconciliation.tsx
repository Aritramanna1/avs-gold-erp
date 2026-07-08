import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSettings } from "@/lib/settings-store";
import {
  runGoldReconciliation,
  getReconciliationHistory,
  type ReconciliationReport,
} from "@/lib/reconciliation/gold-reconciliation";
import { mgToGrams } from "@/lib/gold";
import { exportToCSV } from "@/lib/report-engine";
import { RefreshCw, Loader2, AlertTriangle, CheckCircle2, Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reports/gold-reconciliation")({
  head: () => ({ meta: [{ title: "Gold Reconciliation · AVS Gold ERP" }] }),
  component: GoldReconciliationPage,
});

function GoldReconciliationPage() {
  const selectedBranchId = useSettings((s) => s.selectedBranchId);
  const [history, setHistory] = useState<ReconciliationReport[]>([]);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      setHistory(await getReconciliationHistory(20));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleRunNow() {
    setRunning(true);
    try {
      const report = await runGoldReconciliation(selectedBranchId || undefined);
      toast(
        report.exceptionCount === 0
          ? `Checked ${report.totalChecked} bills — all balanced.`
          : `Checked ${report.totalChecked} bills — ${report.exceptionCount} discrepancy/discrepancies found.`,
      );
      await refresh();
    } finally {
      setRunning(false);
    }
  }

  const latest = history[0];

  function handleCSV() {
    const header = ["Run", "Branch", "Bills Checked", "Discrepancies"];
    const data = history.map((r) => [
      new Date(r.generatedAt).toLocaleString(),
      r.branchId ?? "All Branches",
      r.totalChecked,
      r.exceptionCount,
    ]);
    exportToCSV("gold-reconciliation-history.csv", [header, ...data]);
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Gold Reconciliation"
        subtitle="Every finalised manufacturing bill: issued fine gold vs. accounted fine gold. Even a 0.001g discrepancy is flagged."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCSV} className="gap-2">
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button onClick={handleRunNow} disabled={running} className="gap-2">
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Run Reconciliation Now
            </Button>
          </div>
        }
      />

      {latest && (
        <div className="grid sm:grid-cols-3 gap-3 mb-6">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground">Last Run</div>
            <div className="font-semibold">{new Date(latest.generatedAt).toLocaleString()}</div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground">Bills Checked</div>
            <div className="text-2xl font-semibold">{latest.totalChecked}</div>
          </div>
          <div
            className={`rounded-2xl border p-4 ${latest.exceptionCount > 0 ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"}`}
          >
            <div className="text-xs text-muted-foreground">Discrepancies</div>
            <div
              className={`text-2xl font-semibold ${latest.exceptionCount > 0 ? "text-destructive" : ""}`}
            >
              {latest.exceptionCount}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border font-semibold">Reconciliation History</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="p-3">Run</th>
                <th className="p-3">Branch</th>
                <th className="p-3">Checked</th>
                <th className="p-3">Discrepancies</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    {loading
                      ? "Loading…"
                      : "No reconciliation runs yet — click Run Reconciliation Now."}
                  </td>
                </tr>
              )}
              {history.map((r) => (
                <Fragment key={r.id}>
                  <tr className="border-b border-border last:border-0">
                    <td className="p-3">{new Date(r.generatedAt).toLocaleString()}</td>
                    <td className="p-3">{r.branchId ?? "All Branches"}</td>
                    <td className="p-3">{r.totalChecked}</td>
                    <td className="p-3">
                      {r.exceptionCount === 0 ? (
                        <Badge className="bg-green-600 hover:bg-green-600 gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Balanced
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" /> {r.exceptionCount}
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {r.exceptionCount > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                        >
                          {expanded === r.id ? "Hide" : "View"} Details
                        </Button>
                      )}
                    </td>
                  </tr>
                  {expanded === r.id && (
                    <tr>
                      <td colSpan={5} className="p-0">
                        <div className="p-3 bg-muted/20">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-muted-foreground">
                                <th className="p-2">Bill No</th>
                                <th className="p-2">Issued</th>
                                <th className="p-2">Accounted</th>
                                <th className="p-2">Discrepancy</th>
                              </tr>
                            </thead>
                            <tbody>
                              {r.exceptions.map((e) => (
                                <tr key={e.billId}>
                                  <td className="p-2">{e.billNo}</td>
                                  <td className="p-2">{mgToGrams(e.issuedFineMg)}g</td>
                                  <td className="p-2">{mgToGrams(e.accountedFineMg)}g</td>
                                  <td className="p-2 text-destructive font-semibold">
                                    {mgToGrams(e.discrepancyMg)}g
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
