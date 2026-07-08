import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSettlements, previewSettlementTotals } from "@/lib/settlement-store";
import { fmtRs, fmtDate, exportToCSV } from "@/lib/report-engine";
import { Download } from "lucide-react";

export const Route = createFileRoute("/reports/settlements")({
  head: () => ({ meta: [{ title: "Settlement Report · AVS Gold ERP" }] }),
  component: SettlementReportPage,
});

const STATUS_LABELS: Record<string, string> = {
  pending_settlement: "Pending Settlement",
  partially_settled: "Partially Settled",
  credit_delivery: "Credit Delivery",
  settled: "Settled",
};

/**
 * Every Customer Settlement (draft or finalised), with the same total
 * previewSettlementTotals() computes on the Draft/Final screens themselves —
 * no separate total logic here, so this list can't disagree with what an
 * operator sees when opening any one settlement.
 */
function SettlementReportPage() {
  const settlements = useSettlements((s) => s.settlements);
  const refresh = useSettlements((s) => s.refresh);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => {
    return settlements
      .map((s) => ({
        s,
        totals: previewSettlementTotals(s.items, s.gst, s.payments),
      }))
      .filter((r) => statusFilter === "all" || r.s.financialStatus === statusFilter)
      .sort((a, b) => b.s.createdAt - a.s.createdAt);
  }, [settlements, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of settlements) counts[s.financialStatus] = (counts[s.financialStatus] ?? 0) + 1;
    return counts;
  }, [settlements]);

  function handleCSV() {
    const header = ["Settlement No", "Date", "Customer", "Status", "Grand Total", "Balance"];
    const data = rows.map(({ s, totals }) => [
      s.settlementNo,
      fmtDate(s.createdAt),
      s.customerName,
      STATUS_LABELS[s.financialStatus] ?? s.financialStatus,
      fmtRs(totals.grandTotalPaise),
      fmtRs(totals.balancePaise),
    ]);
    exportToCSV("settlement-report.csv", [header, ...data]);
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Settlement Report"
        subtitle="Every Customer Settlement, draft through finalised"
        actions={
          <Button variant="outline" size="sm" className="gap-2" onClick={handleCSV}>
            <Download className="h-4 w-4" /> CSV
          </Button>
        }
      />

      <div className="flex flex-wrap gap-1.5 mt-4 mb-4" data-testid="settlement-status-filter">
        {["all", "pending_settlement", "partially_settled", "credit_delivery", "settled"].map(
          (key) => (
            <Button
              key={key}
              size="sm"
              variant={statusFilter === key ? "default" : "outline"}
              onClick={() => setStatusFilter(key)}
            >
              {key === "all" ? "All" : STATUS_LABELS[key]}
              {key !== "all" && statusCounts[key] ? ` (${statusCounts[key]})` : ""}
            </Button>
          ),
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="settlement-report-table">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">Settlement No</th>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Customer</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Grand Total</th>
                <th className="text-right p-3">Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ s, totals }) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="p-3">
                    <Link
                      to="/settlement/$id"
                      params={{ id: s.id }}
                      className="text-gold hover:underline"
                    >
                      {s.settlementNo}
                    </Link>
                  </td>
                  <td className="p-3">{fmtDate(s.createdAt)}</td>
                  <td className="p-3">{s.customerName}</td>
                  <td className="p-3">
                    <Badge variant="outline">
                      {STATUS_LABELS[s.financialStatus] ?? s.financialStatus}
                    </Badge>
                  </td>
                  <td className="p-3 text-right font-mono">{fmtRs(totals.grandTotalPaise)}</td>
                  <td className="p-3 text-right font-mono">{fmtRs(totals.balancePaise)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    No settlements found.
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
