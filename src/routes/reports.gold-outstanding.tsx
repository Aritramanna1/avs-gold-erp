import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMfgBills } from "@/lib/manufacturing-bill-store";
import { useJobCards, karigarCustodySummaries } from "@/lib/jobcards-store";
import { useWorkerGoldBook } from "@/lib/worker-gold-book-store";
import { mgToGrams } from "@/lib/gold";
import { exportToCSV } from "@/lib/report-engine";
import { AlertTriangle, Download } from "lucide-react";

export const Route = createFileRoute("/reports/gold-outstanding")({
  head: () => ({ meta: [{ title: "Gold Outstanding Report · AVS Gold ERP" }] }),
  component: GoldOutstandingPage,
});

export interface OutstandingRow {
  source: "Manufacturing Bill" | "Job Custody" | "Worker Gold Book";
  name: string;
  reference: string;
  outstandingMg: number;
}

/**
 * The single canonical cross-module gold-outstanding computation — every
 * gram outstanding anywhere in the business (manufacturing bill karigar
 * balances, job-card custody, worker gold book). Exported so the CEO
 * Dashboard's "Gold Outstanding" KPI reuses this exact function instead of
 * recomputing it, guaranteeing the two screens can never disagree.
 */
export function computeGoldOutstandingRows(
  bills: ReturnType<typeof useMfgBills.getState>["bills"],
  jobs: ReturnType<typeof useJobCards.getState>["jobs"],
  workerEntries: ReturnType<typeof useWorkerGoldBook.getState>["entries"],
  getWorkerBalance: ReturnType<typeof useWorkerGoldBook.getState>["getWorkerBalance"],
): OutstandingRow[] {
  const out: OutstandingRow[] = [];

  for (const b of bills) {
    if (b.closingBalanceMg !== 0) {
      out.push({
        source: "Manufacturing Bill",
        name: b.karigarName ?? "—",
        reference: b.billNo,
        outstandingMg: b.closingBalanceMg,
      });
    }
  }

  const custody = karigarCustodySummaries(jobs);
  for (const c of custody) {
    if (c.outstandingMg !== 0) {
      out.push({
        source: "Job Custody",
        name: c.karigarName,
        reference: `${c.jobs.length} job(s)`,
        outstandingMg: c.outstandingMg,
      });
    }
  }

  const workerIds = Array.from(new Set(workerEntries.map((e) => e.workerId)));
  for (const workerId of workerIds) {
    const balance = getWorkerBalance(workerId);
    if (balance.pendingFine !== 0) {
      const entry = workerEntries.find((e) => e.workerId === workerId);
      out.push({
        source: "Worker Gold Book",
        name: entry?.workerName ?? workerId,
        reference: "Materials/findings ledger",
        outstandingMg: balance.pendingFine,
      });
    }
  }

  return out.sort((a, b) => Math.abs(b.outstandingMg) - Math.abs(a.outstandingMg));
}

/**
 * A single, cross-module view of every gram of gold currently outstanding
 * anywhere in the business — manufacturing bill karigar balances, job-card
 * custody, and the separate worker gold book (dies/findings/materials, not
 * job-linked). Each row traces back to its source so a manager can act on
 * it, not just see a number.
 */
function GoldOutstandingPage() {
  const bills = useMfgBills((s) => s.bills);
  const jobs = useJobCards((s) => s.jobs);
  const workerEntries = useWorkerGoldBook((s) => s.entries);
  const getWorkerBalance = useWorkerGoldBook((s) => s.getWorkerBalance);

  const rows: OutstandingRow[] = useMemo(
    () => computeGoldOutstandingRows(bills, jobs, workerEntries, getWorkerBalance),
    [bills, jobs, workerEntries, getWorkerBalance],
  );

  const totalMg = rows.reduce((s, r) => s + Math.abs(r.outstandingMg), 0);
  const owedToUs = rows
    .filter((r) => r.outstandingMg < 0)
    .reduce((s, r) => s + Math.abs(r.outstandingMg), 0);
  const owedByUs = rows.filter((r) => r.outstandingMg > 0).reduce((s, r) => s + r.outstandingMg, 0);

  function handleCSV() {
    const header = ["Source", "Name", "Reference", "Outstanding (g)"];
    const data = rows.map((r) => [r.source, r.name, r.reference, mgToGrams(r.outstandingMg)]);
    exportToCSV("gold-outstanding.csv", [header, ...data]);
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Gold Outstanding Report"
        subtitle="Every gram of gold currently outstanding across manufacturing bills, job custody, and the worker gold book — one list, traceable to its source."
        actions={
          <Button variant="outline" size="sm" className="gap-2" onClick={handleCSV}>
            <Download className="h-4 w-4" /> CSV
          </Button>
        }
      />

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
          <div className="text-2xl font-mono font-bold text-amber-600">{mgToGrams(owedToUs)} g</div>
        </div>
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
            Owed By Us (Jama to karigars/workers)
          </div>
          <div className="text-2xl font-mono font-bold text-red-600">{mgToGrams(owedByUs)} g</div>
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
                    No outstanding gold anywhere — everything is settled.
                  </td>
                </tr>
              )}
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="p-3">
                    <Badge variant="secondary">{r.source}</Badge>
                  </td>
                  <td className="p-3 font-medium">{r.name}</td>
                  <td className="p-3 text-muted-foreground">{r.reference}</td>
                  <td className="p-3 text-right font-mono">
                    <span className={r.outstandingMg > 0 ? "text-red-600" : "text-amber-600"}>
                      {mgToGrams(Math.abs(r.outstandingMg))} g
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
