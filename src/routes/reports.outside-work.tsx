import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOutsideWork, computeOutsideWorkPosition } from "@/lib/outside-work-store";
import { mgToGrams } from "@/lib/gold";
import { exportToCSV, fmtDate, triggerPrint } from "@/lib/report-engine";
import { Download, Printer } from "lucide-react";

export const Route = createFileRoute("/reports/outside-work")({
  head: () => ({ meta: [{ title: "Outside Work Report · AVS Gold ERP" }] }),
  component: OutsideWorkReportPage,
});

/**
 * Per-jeweller outside-work position — reuses computeOutsideWorkPosition()
 * (the same helper the Outside Work workflow page itself uses), grouped by
 * jewellerId, so this can never disagree with what an operator sees on that
 * jeweller's own position view.
 */
function OutsideWorkReportPage() {
  const transactions = useOutsideWork((s) => s.transactions);
  const refresh = useOutsideWork((s) => s.refresh);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => {
    const byJeweller = new Map<string, typeof transactions>();
    for (const t of transactions) {
      const list = byJeweller.get(t.jewellerId) ?? [];
      list.push(t);
      byJeweller.set(t.jewellerId, list);
    }
    return Array.from(byJeweller.entries())
      .map(([jewellerId, txns]) => {
        const position = computeOutsideWorkPosition(txns);
        return {
          jewellerId,
          jewellerName: txns[0]?.jewellerName ?? jewellerId,
          ...position,
        };
      })
      .sort((a, b) => b.pendingGoldFineMg - a.pendingGoldFineMg);
  }, [transactions]);

  function handleCSV() {
    const header = [
      "Jeweller",
      "Pending Gold (g)",
      "Pending Material (g)",
      "Total Issued (g)",
      "Total Returned (g)",
      "Last Transaction",
    ];
    const data = rows.map((r) => [
      r.jewellerName,
      mgToGrams(r.pendingGoldFineMg),
      mgToGrams(r.pendingMaterialGrossMg),
      mgToGrams(r.totalIssuedFineMg),
      mgToGrams(r.totalReturnedFineMg),
      r.lastTransactionTs ? fmtDate(r.lastTransactionTs) : "—",
    ]);
    exportToCSV("outside-work-report.csv", [header, ...data]);
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Outside Work Report"
        subtitle="Per-jeweller pending gold and material across every Outside Work transaction"
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
          <table className="w-full text-sm" data-testid="outside-work-report-table">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">Jeweller</th>
                <th className="text-right p-3">Pending Gold</th>
                <th className="text-right p-3">Pending Material</th>
                <th className="text-right p-3">Last Transaction</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.jewellerId} className="border-t border-border">
                  <td className="p-3">{r.jewellerName}</td>
                  <td className="p-3 text-right font-mono">
                    {r.pendingGoldFineMg > 0 ? (
                      <Badge variant="outline" className="border-amber-500/40 text-amber-400">
                        {mgToGrams(r.pendingGoldFineMg)}g
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">0.000g</span>
                    )}
                  </td>
                  <td className="p-3 text-right font-mono">
                    {mgToGrams(r.pendingMaterialGrossMg)}g
                  </td>
                  <td className="p-3 text-right">
                    {r.lastTransactionTs ? fmtDate(r.lastTransactionTs) : "—"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-muted-foreground">
                    No outside work transactions found.
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
