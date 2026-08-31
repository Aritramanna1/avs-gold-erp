import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { guardRoute } from "@/lib/permissions";
import { PageHeader } from "@/components/app-shell";
import { ReportShell } from "@/components/reports/ReportShell";
import { useLedger, computeBalances } from "@/lib/ledger-store";
import { buildVaultGoldPurityLines } from "@/lib/vault-gold-stock";
import { mgToGrams } from "@/lib/gold";
import { exportToCSV, triggerPrint, type ReportPeriod } from "@/lib/report-engine";
import { fmtG } from "@/lib/report-engine";
import { EmailDocumentButton } from "@/components/email-document-button";
import { useSettings } from "@/lib/settings-store";

export const Route = createFileRoute("/reports/gold-stock")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Gold Stock by Purity · AVS ERP" }] }),
  component: GoldStockReportPage,
});

function GoldStockReportPage() {
  const entries = useLedger((s) => s.entries);
  const refresh = useLedger((s) => s.refresh);
  const [period, setPeriod] = useState<ReportPeriod>("monthly");
  const shopName = useSettings((s) => s.firm.shopName);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const balance = useMemo(() => computeBalances(entries), [entries]);
  const lines = useMemo(() => buildVaultGoldPurityLines(entries), [entries]);

  const openingFineMg = balance.buckets.vault + balance.buckets.scrap;
  const closingFineMg = lines.reduce((s, l) => s + l.availableFineMg, 0);

  function handleExport() {
    exportToCSV("gold-stock-by-purity.csv", [
      ["Location", "Purity ‰", "Touch %", "Fine g", "Gross g"],
      ...lines.map((l) => [
        l.location,
        String(l.purity),
        String(l.touchPct),
        fmtG(l.availableFineMg),
        fmtG(l.availableGrossMg),
      ]),
    ]);
  }

  const emailBody = useMemo(() => {
    const rows = lines
      .map(
        (l) =>
          `${l.location} | ${l.purity}‰ | fine ${fmtG(l.availableFineMg)} g | gross ${fmtG(l.availableGrossMg)} g`,
      )
      .join("\n");
    return `Gold stock by purity — ${shopName || "Firm"}\n\nOpening vault+scrap fine: ${mgToGrams(openingFineMg)} g\nClosing line total: ${mgToGrams(closingFineMg)} g fine\n\n${rows || "(no lines)"}`;
  }, [lines, shopName, openingFineMg, closingFineMg]);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Gold Stock by Purity"
        subtitle="Vault and scrap purity lines derived from the gold ledger — reconcile to physical stock audit."
      />
      <ReportShell
        title="Vault & scrap purity register"
        variant="report"
        period={period}
        onPeriodChange={setPeriod}
        openingLabel={`Opening vault+scrap fine: ${mgToGrams(openingFineMg)} g`}
        closingLabel={`Closing line total: ${mgToGrams(closingFineMg)} g fine`}
        onRefresh={() => void refresh()}
        onExport={handleExport}
        onPrint={() => triggerPrint()}
        filters={
          <EmailDocumentButton
            subject={`Gold Stock by Purity — ${shopName || "Firm"}`}
            body={emailBody}
            label="Email report"
          />
        }
      >
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="text-left py-2 px-3">Location</th>
                <th className="text-right px-3">Purity ‰</th>
                <th className="text-right px-3">Touch %</th>
                <th className="text-right px-3">Fine (g)</th>
                <th className="text-right px-3">Gross (g)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lines.map((l) => (
                <tr key={l.id} className="hover:bg-muted/30">
                  <td className="py-2 px-3">{l.location}</td>
                  <td className="text-right px-3 font-mono">{l.purity}</td>
                  <td className="text-right px-3 font-mono">{l.touchPct}</td>
                  <td className="text-right px-3 font-mono">{fmtG(l.availableFineMg)}</td>
                  <td className="text-right px-3 font-mono">{fmtG(l.availableGrossMg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReportShell>
    </div>
  );
}
