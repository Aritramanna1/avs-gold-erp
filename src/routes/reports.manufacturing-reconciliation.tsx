import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMfgBills } from "@/lib/manufacturing-bill-store";
import { mgToGrams } from "@/lib/gold";
import { exportToCSV } from "@/lib/report-engine";
import { AlertTriangle, CheckCircle2, Download } from "lucide-react";

export const Route = createFileRoute("/reports/manufacturing-reconciliation")({
  head: () => ({ meta: [{ title: "Manufacturing Reconciliation · AVS Gold ERP" }] }),
  component: ManufacturingReconciliationPage,
});

/**
 * Re-derives each Manufacturing Bill's actualWastageFineMg from its own
 * stored totalGoldIssuedFineMg/totalGoldReturnedFineMg fields using the
 * exact same formula manufacturing-bill-store.ts's patch() applies on every
 * edit (max(0, issued - returned)) — not a new calculation, just verifying
 * the stored derived field still agrees with its inputs. A mismatch means
 * a bill was created/migrated through a path that didn't go through patch()
 * (e.g. a direct Supabase write, or a field edited after the fact).
 */
function ManufacturingReconciliationPage() {
  const bills = useMfgBills((s) => s.bills);
  const refresh = useMfgBills((s) => s.refresh);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => {
    return bills.map((b) => {
      const expectedWastageMg = Math.max(0, b.totalGoldIssuedFineMg - b.totalGoldReturnedFineMg);
      const wastageMatches = expectedWastageMg === b.actualWastageFineMg;
      return { bill: b, expectedWastageMg, wastageMatches };
    });
  }, [bills]);

  const exceptions = rows.filter((r) => !r.wastageMatches);

  function handleCSV() {
    const header = ["Bill No", "Karigar", "Stored Wastage (g)", "Re-derived Wastage (g)", "Status"];
    const data = rows.map((r) => [
      r.bill.billNo,
      r.bill.karigarName ?? "—",
      mgToGrams(r.bill.actualWastageFineMg),
      mgToGrams(r.expectedWastageMg),
      r.wastageMatches ? "OK" : "Mismatch",
    ]);
    exportToCSV("manufacturing-reconciliation.csv", [header, ...data]);
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Manufacturing Reconciliation"
        subtitle="Each Manufacturing Bill's stored wastage vs. re-deriving it from the bill's own issued/returned fields"
        actions={
          <Button variant="outline" size="sm" className="gap-2" onClick={handleCSV}>
            <Download className="h-4 w-4" /> CSV
          </Button>
        }
      />

      <div className="rounded-2xl border border-border bg-card p-4 mt-4 mb-4">
        {exceptions.length === 0 ? (
          <div className="text-sm text-emerald-500 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Every bill's stored wastage figure agrees with its
            own issued/returned fields.
          </div>
        ) : (
          <div className="text-sm text-amber-500 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> {exceptions.length} bill(s) have a stored wastage
            figure that no longer matches issued − returned.
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="manufacturing-reconciliation-table">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">Bill No</th>
                <th className="text-left p-3">Karigar</th>
                <th className="text-right p-3">Stored Wastage</th>
                <th className="text-right p-3">Re-derived Wastage</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .filter((r) => !r.wastageMatches)
                .concat(rows.filter((r) => r.wastageMatches))
                .map((r) => (
                  <tr key={r.bill.id} className="border-t border-border">
                    <td className="p-3">{r.bill.billNo}</td>
                    <td className="p-3">{r.bill.karigarName ?? "—"}</td>
                    <td className="p-3 text-right font-mono">
                      {mgToGrams(r.bill.actualWastageFineMg)}g
                    </td>
                    <td className="p-3 text-right font-mono">{mgToGrams(r.expectedWastageMg)}g</td>
                    <td className="p-3">
                      {r.wastageMatches ? (
                        <Badge variant="outline">OK</Badge>
                      ) : (
                        <Badge variant="destructive">Mismatch</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    No manufacturing bills yet.
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
