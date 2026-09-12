import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { calculateLiveGoldExposure, computeBalances, useLedger } from "@/lib/ledger-store";
import { useOrders } from "@/lib/orders-store";
import { exportToCSV, fmtG, triggerPrint } from "@/lib/report-engine";
import { Download, Printer } from "lucide-react";

export const Route = createFileRoute("/reports/metal-position")({
  head: () => ({ meta: [{ title: "Metal Position · AVS ERP" }] }),
  component: MetalPositionPage,
});

function pendingOrderFineMg(
  orders: Array<{ status: string; items: Array<{ fineMg: number }> }>,
): number {
  return orders
    .filter((o) => o.status !== "delivered" && o.status !== "cancelled")
    .reduce((sum, o) => sum + o.items.reduce((line, item) => line + Math.max(0, item.fineMg), 0), 0);
}

import { useSettings } from "@/lib/settings-store";
import { APP_NAME } from "@/lib/app-info";

function MetalPositionPage() {
  const entries = useLedger((s) => s.entries);
  const refreshLedger = useLedger((s) => s.refresh);
  const orders = useOrders((s) => s.orders);
  const refreshOrders = useOrders((s) => s.refresh);
  const branding = useSettings((s) => s.branding);
  const firm = useSettings((s) => s.firm);
  const companyName = firm?.shopName || branding.companyName || APP_NAME;

  useEffect(() => {
    void refreshLedger();
    void refreshOrders();
  }, [refreshLedger, refreshOrders]);

  const exposure = useMemo(() => {
    const sheet = computeBalances(entries);
    return calculateLiveGoldExposure(sheet.buckets, pendingOrderFineMg(orders));
  }, [entries, orders]);

  const stance = exposure.isRiskOverdraft ? "Short" : "Long";

  function handleCSV() {
    exportToCSV("metal-position.csv", [
      ["Metric", "Fine g"],
      ["Vault", fmtG(exposure.totalVaultGoldMg)],
      ["Karigar", fmtG(exposure.totalKarigarGoldMg)],
      ["Finished", fmtG(exposure.totalFinishedGoldMg)],
      ["Physical total", fmtG(exposure.netPhysicalGoldMg)],
      ["Customer deposits", fmtG(exposure.totalCustomerUnlinkedGoldMg)],
      ["Open orders", fmtG(exposure.totalPendingOrdersGoldMg)],
      ["Net unhedged (long + / short −)", fmtG(exposure.netUnhedgedGoldExposureMg)],
    ]);
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6 print:p-4 print:max-w-none print:m-0 print:space-y-4 print:text-black">
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
            <h2 className="text-base font-bold text-black uppercase tracking-wider">Metal Position (Short / Long)</h2>
            <p className="text-xs text-gray-600 font-medium">Bullion Stance & Rate Risk</p>
            <p className="text-[9px] text-gray-400 mt-1">
              Printed on: {new Date().toLocaleString("en-IN")}
            </p>
          </div>
        </div>
      </div>

      <div className="print:hidden">
        <PageHeader
          title="Metal Position (Short / Long)"
          subtitle="Bullion stance from the gold ledger plus open orders. Custody map stays on Where Is My Gold? — this is rate-risk, not location."
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

      <div className="rounded-md border border-border print:border-black/30 p-4 space-y-2">
        <p className="text-sm font-semibold print:text-black">
          Position: {stance} {fmtG(Math.abs(exposure.netUnhedgedGoldExposureMg))}
        </p>
        <p className="text-xs text-muted-foreground print:text-gray-600">
          Long = owned unpriced metal above customer claims. Short = sold or booked more fine than
          you hold.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 text-sm print:grid-cols-3 print:gap-2">
        <Metric label="Vault" value={fmtG(exposure.totalVaultGoldMg)} />
        <Metric label="Karigar custody" value={fmtG(exposure.totalKarigarGoldMg)} />
        <Metric label="Finished" value={fmtG(exposure.totalFinishedGoldMg)} />
        <Metric label="Physical total" value={fmtG(exposure.netPhysicalGoldMg)} />
        <Metric label="Customer deposits" value={fmtG(exposure.totalCustomerUnlinkedGoldMg)} />
        <Metric label="Open order fine" value={fmtG(exposure.totalPendingOrdersGoldMg)} />
      </div>

      <ul className="text-xs text-muted-foreground print:text-gray-600 space-y-1 list-disc pl-4">
        {exposure.explanation.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-mono mt-1">{value}</div>
    </div>
  );
}
