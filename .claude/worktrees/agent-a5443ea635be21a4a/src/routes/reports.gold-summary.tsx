import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { useMfgBills } from "@/lib/manufacturing-bill-store";
import { useJobCards, karigarCustodySummaries } from "@/lib/jobcards-store";
import { useSettings } from "@/lib/settings-store";
import { mgToGrams } from "@/lib/gold";
import { Coins } from "lucide-react";

export const Route = createFileRoute("/reports/gold-summary")({
  head: () => ({ meta: [{ title: "Manufacturing Gold Summary · MTJ ERP" }] }),
  component: GoldSummaryPage,
});

/**
 * Gold-first reporting for the Manufacturing Billing module. Gold is the
 * primary accounting unit here: every figure on this page is fine gold in
 * grams, never cash — a dedicated cash view exists in the ordinary Reports
 * index for whoever needs it, but this page exists specifically so gold
 * position is never buried behind currency totals.
 */
function GoldSummaryPage() {
  const bills = useMfgBills((s) => s.bills);
  const jobs = useJobCards((s) => s.jobs);
  const selectedBranchId = useSettings((s) => s.selectedBranchId);

  const branchBills = useMemo(
    () => bills.filter((b) => b.branchId === selectedBranchId || !selectedBranchId),
    [bills, selectedBranchId],
  );

  const totals = useMemo(() => {
    return branchBills.reduce(
      (acc, b) => {
        acc.required += b.totalGoldIssuedFineMg;
        acc.returned += b.totalGoldReturnedFineMg;
        acc.wastage += b.actualWastageFineMg;
        acc.outstanding += b.closingBalanceMg;
        return acc;
      },
      { required: 0, returned: 0, wastage: 0, outstanding: 0 },
    );
  }, [branchBills]);

  const custody = useMemo(() => karigarCustodySummaries(jobs), [jobs]);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Manufacturing Gold Summary"
        subtitle="Gold is the primary accounting unit — every figure below is fine gold, not cash."
      />

      <div className="grid sm:grid-cols-4 gap-3 mb-8">
        <GoldStatCard label="Total Gold Required" value={totals.required} color="text-blue-500" />
        <GoldStatCard label="Total Gold Returned" value={totals.returned} color="text-emerald-500" />
        <GoldStatCard label="Total Wastage" value={totals.wastage} color="text-amber-500" />
        <GoldStatCard
          label="Net Outstanding Gold"
          value={Math.abs(totals.outstanding)}
          color={totals.outstanding === 0 ? "text-emerald-500" : totals.outstanding > 0 ? "text-amber-500" : "text-red-500"}
          sub={totals.outstanding === 0 ? "Settled" : totals.outstanding > 0 ? "Jama (owed to karigars)" : "Udhar (owed by karigars)"}
        />
      </div>

      <div className="flex items-center gap-2 mb-3">
        <Coins className="h-4 w-4 text-gold" />
        <h2 className="font-serif text-lg">Dealer / Karigar Gold Position</h2>
      </div>
      <div className="rounded-2xl border border-border bg-card overflow-hidden mb-8">
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
            {custody.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  No karigar gold custody data yet.
                </td>
              </tr>
            )}
            {custody.map((c) => (
              <tr key={c.karigarId} className="border-b border-border last:border-0">
                <td className="p-3 font-medium">{c.karigarName}</td>
                <td className="p-3 text-right font-mono">{mgToGrams(c.issuedMg)}</td>
                <td className="p-3 text-right font-mono">{mgToGrams(c.finishedMg)}</td>
                <td className="p-3 text-right font-mono">{mgToGrams(c.scrapMg)}</td>
                <td className="p-3 text-right font-mono">{mgToGrams(c.filingsMg)}</td>
                <td className="p-3 text-right font-mono text-amber-600">{mgToGrams(c.wastageMg)}</td>
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

      <div className="flex items-center gap-2 mb-3">
        <Coins className="h-4 w-4 text-gold" />
        <h2 className="font-serif text-lg">Manufacturing Bills — Gold Outstanding</h2>
      </div>
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
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
            {branchBills
              .filter((b) => b.closingBalanceMg !== 0)
              .sort((a, b) => Math.abs(b.closingBalanceMg) - Math.abs(a.closingBalanceMg))
              .map((b) => (
                <tr key={b.id} className="border-b border-border last:border-0">
                  <td className="p-3">{b.billNo}</td>
                  <td className="p-3">{b.karigarName ?? "—"}</td>
                  <td className="p-3 text-right font-mono">{mgToGrams(b.totalGoldIssuedFineMg)}</td>
                  <td className="p-3 text-right font-mono">{mgToGrams(b.totalGoldReturnedFineMg)}</td>
                  <td className="p-3 text-right font-mono text-amber-600">{mgToGrams(b.actualWastageFineMg)}</td>
                  <td className="p-3 text-right font-mono">
                    <span className={b.closingBalanceMg > 0 ? "text-amber-600" : "text-red-600"}>
                      {mgToGrams(Math.abs(b.closingBalanceMg))} g
                    </span>
                  </td>
                </tr>
              ))}
            {branchBills.every((b) => b.closingBalanceMg === 0) && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  Every manufacturing bill is fully settled in gold — no outstanding balances.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{label}</div>
      <div className={`text-2xl font-mono font-bold ${color}`}>{mgToGrams(value)} g</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
