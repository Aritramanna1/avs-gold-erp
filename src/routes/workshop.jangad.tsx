import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { SourceOfTruthBadge } from "@/components/ledger/SourceOfTruthBadge";
import { useOutsideWork, computeOutsideWorkPosition } from "@/lib/outside-work-store";
import { usePeople } from "@/lib/people-store";
import { mgToGrams } from "@/lib/gold";
import { ClipboardList, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/workshop/jangad")({
  head: () => ({ meta: [{ title: "Jangad · AVS ERP" }] }),
  component: JangadPage,
});

function JangadPage() {
  const people = usePeople((s) => s.people);
  const transactions = useOutsideWork((s) => s.transactions);
  const refresh = useOutsideWork((s) => s.refresh);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const pending = useMemo(() => {
    const grouped = new Map<string, typeof transactions>();
    for (const t of transactions) {
      const list = grouped.get(t.jewellerId) ?? [];
      list.push(t);
      grouped.set(t.jewellerId, list);
    }
    return [...grouped.entries()]
      .map(([jewellerId, txns]) => {
        const pos = computeOutsideWorkPosition(txns);
        const name =
          people.find((p) => p.id === jewellerId)?.fullName ||
          txns[0]?.jewellerName ||
          jewellerId;
        return {
          partyId: jewellerId,
          name,
          ...pos,
        };
      })
      .filter((r) => r.pendingGoldFineMg > 0 || r.pendingMaterialGrossMg > 0)
      .sort((a, b) => b.pendingGoldFineMg - a.pendingGoldFineMg);
  }, [transactions, people]);

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Jangad (Pending Slips)"
        subtitle="Offline Jangad pending — outside-work issue/receive that is still open"
        actions={<SourceOfTruthBadge variant="operational" />}
      />

      <div className="erp-surface rounded-xl p-5 space-y-3">
        <div className="flex items-start gap-3">
          <ClipboardList className="h-5 w-5 text-gold shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              Jangad slips are outside-work challans with metal still outstanding at the jeweller /
              karigar. Review pending positions below, then issue or receive on Outside Work.
            </p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Confirm party and pending fine / material gross.</li>
              <li>Open Outside Work to issue more metal or receive return.</li>
              <li>Settle labour and gold hisab when the jangad closes.</li>
            </ol>
          </div>
        </div>
        <Button asChild>
          <Link to="/workshop/outside-work">
            Open Outside Work
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      </div>

      <div className="erp-surface rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Party</th>
              <th className="px-3 py-2 text-right">Pending fine (g)</th>
              <th className="px-3 py-2 text-right">Pending material (g)</th>
            </tr>
          </thead>
          <tbody>
            {pending.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                  No pending jangad slips.
                </td>
              </tr>
            ) : (
              pending.map((r) => (
                <tr key={r.partyId} className="border-t border-border/60">
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2 font-mono text-right">{mgToGrams(r.pendingGoldFineMg)}</td>
                  <td className="px-3 py-2 font-mono text-right">
                    {mgToGrams(r.pendingMaterialGrossMg)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
