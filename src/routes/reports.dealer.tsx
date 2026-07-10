import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePeople } from "@/lib/people-store";
import { useGoldSettlement } from "@/lib/gold-settlement-store";
import { mgToGrams } from "@/lib/gold";
import { fmtRs, fmtDate, exportToCSV, triggerPrint } from "@/lib/report-engine";
import { Download, Printer } from "lucide-react";

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
  const people = usePeople((s) => s.people);
  const refreshPeople = usePeople((s) => s.refresh);
  const goldSettlements = useGoldSettlement((s) => s.settlements);
  const refreshGoldSettlements = useGoldSettlement((s) => s.refresh);

  useEffect(() => {
    refreshPeople();
    refreshGoldSettlements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dealers = useMemo(() => people.filter((p) => p.type === "vendor"), [people]);

  const rows = useMemo(
    () =>
      dealers.map((d) => {
        const dealerSettlements = goldSettlements
          .filter((s) => s.party_type === "vendor" && s.party_id === d.id)
          .sort((a, b) => (a.settlement_date < b.settlement_date ? 1 : -1));
        const latest = dealerSettlements[0];
        return {
          id: d.id,
          name: d.fullName,
          transactionCount: dealerSettlements.length,
          goldBalanceMg: latest?.p_balance_gold_mg ?? 0,
          cashBalancePaise: latest?.p_balance_cash_paise ?? 0,
          lastSettlementDate: latest?.settlement_date ?? null,
        };
      }),
    [dealers, goldSettlements],
  );

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

      <div className="rounded-2xl border border-border bg-card overflow-hidden mt-4">
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
