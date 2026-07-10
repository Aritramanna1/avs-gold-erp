import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { usePeople } from "@/lib/people-store";
import { useWorkerGoldBook } from "@/lib/worker-gold-book-store";
import { useGoldSettlement } from "@/lib/gold-settlement-store";
import { mgToGrams } from "@/lib/gold";
import { exportToCSV, triggerPrint } from "@/lib/report-engine";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";

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
  const people = usePeople((s) => s.people);
  const refreshPeople = usePeople((s) => s.refresh);
  const getWorkerBalance = useWorkerGoldBook((s) => s.getWorkerBalance);
  const refreshGoldBook = useWorkerGoldBook((s) => s.refresh);
  const goldSettlements = useGoldSettlement((s) => s.settlements);
  const refreshGoldSettlements = useGoldSettlement((s) => s.refresh);

  useEffect(() => {
    refreshPeople();
    refreshGoldBook();
    refreshGoldSettlements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const workers = useMemo(
    () => people.filter((p) => p.type === "karigar" || p.type === "worker"),
    [people],
  );

  const rows = useMemo(
    () =>
      workers.map((w) => {
        const balance = getWorkerBalance(w.id);
        const workerSettlements = goldSettlements
          .filter((s) => s.party_type === "worker" && s.party_id === w.id)
          .sort((a, b) => (a.settlement_date < b.settlement_date ? 1 : -1));
        return {
          id: w.id,
          name: w.fullName,
          pendingFineMg: balance.pendingFine,
          pendingQty: balance.pendingQty,
          lastSettlementDate: workerSettlements[0]?.settlement_date ?? null,
        };
      }),
    [workers, getWorkerBalance, goldSettlements],
  );

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

      <div className="rounded-2xl border border-border bg-card overflow-hidden mt-4">
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
