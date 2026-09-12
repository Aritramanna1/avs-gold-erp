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
import { useSettings } from "@/lib/settings-store";
import { APP_NAME } from "@/lib/app-info";

function OutsideWorkReportPage() {
  const transactions = useOutsideWork((s) => s.transactions);
  const refresh = useOutsideWork((s) => s.refresh);
  const branding = useSettings((s) => s.branding);
  const firm = useSettings((s) => s.firm);
  const companyName = firm?.shopName || branding.companyName || APP_NAME;

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
    <div className="p-4 md:p-8 max-w-6xl mx-auto print:p-4 print:max-w-none print:m-0 print:space-y-4 print:text-black">
      {/* Print-Only Branded Header */}
      <div className="hidden print:block border-b-2 border-black/80 pb-3 mb-4">
        <div className="flex justify-between items-start">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              {branding.logoUrl && (
                <img src={branding.logoUrl} alt="Logo" className="h-8 w-auto max-w-[120px] object-contain" />
              )}
              <h1 className="text-xl font-bold tracking-tight text-black">{companyName}</h1>
            </div>
            {firm?.tagline && <p className="text-xs text-gray-600">{firm.tagline}</p>}
            {firm?.address && <p className="text-[10px] text-gray-500">{firm.address}</p>}
            {(firm?.phone || firm?.gstin) && (
              <p className="text-[10px] text-gray-500">
                {firm?.phone ? `Phone: ${firm.phone}` : ""}
                {firm?.phone && firm?.gstin ? " | " : ""}
                {firm?.gstin ? `GSTIN: ${firm.gstin}` : ""}
              </p>
            )}
          </div>
          <div className="text-right space-y-0.5">
            <h2 className="text-base font-bold text-black uppercase tracking-wider">Outside Work Report</h2>
            <p className="text-xs text-gray-600 font-medium">Per-Jeweller Outside Position</p>
            <p className="text-[9px] text-gray-400 mt-1">
              Printed on: {new Date().toLocaleString("en-IN")}
            </p>
          </div>
        </div>
      </div>

      <div className="print:hidden">
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
      </div>

      <div className="rounded-md border border-border print:border-black/30 bg-card overflow-hidden mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm print:text-xs" data-testid="outside-work-report-table">
            <thead className="bg-muted/40 print:bg-gray-100 print:text-black text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3 print:p-1.5">Jeweller</th>
                <th className="text-right p-3 print:p-1.5">Pending Gold</th>
                <th className="text-right p-3 print:p-1.5">Pending Material</th>
                <th className="text-right p-3 print:p-1.5">Last Transaction</th>
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
