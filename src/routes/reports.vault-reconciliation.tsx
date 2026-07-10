import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { useLedger, computeBalances } from "@/lib/ledger-store";
import { usePhysicalStockCounts } from "@/lib/physical-stock-verification-store";
import { mgToGrams } from "@/lib/gold";
import { fmtDate, triggerPrint } from "@/lib/report-engine";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Printer } from "lucide-react";

export const Route = createFileRoute("/reports/vault-reconciliation")({
  head: () => ({ meta: [{ title: "Vault Reconciliation · AVS Gold ERP" }] }),
  component: VaultReconciliationPage,
});

/**
 * Reconciles the Gold Ledger's book vault balance (computeBalances() — the
 * same canonical function every other gold report uses) against the most
 * recent completed Physical Stock Count's confirmed shortage. No new
 * calculation: the "book" side is the ledger, the "physical" side is
 * whatever physical-stock-verification-store.ts already posted (or found
 * and hasn't posted yet). This report exists to make that comparison
 * visible in one place — it doesn't recompute either number.
 */
function VaultReconciliationPage() {
  const entries = useLedger((s) => s.entries);
  const refreshLedger = useLedger((s) => s.refresh);
  const counts = usePhysicalStockCounts((s) => s.counts);

  useEffect(() => {
    refreshLedger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bookVaultMg = useMemo(() => computeBalances(entries).buckets.vault, [entries]);

  const completedCounts = useMemo(
    () =>
      counts
        .filter((c) => c.status === "completed")
        .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)),
    [counts],
  );
  const latestCount = completedCounts[0];

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <PageHeader
        title="Vault Reconciliation"
        subtitle="Gold Ledger book balance vs. the most recent Physical Stock Count"
        actions={
          <Button variant="outline" size="sm" className="gap-2" onClick={() => triggerPrint()}>
            <Printer className="h-4 w-4" /> Print
          </Button>
        }
      />

      <div className="grid sm:grid-cols-2 gap-4 mt-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
            Book Vault Balance (Gold Ledger)
          </div>
          <div className="text-2xl font-mono font-bold mt-1">{mgToGrams(bookVaultMg)} g</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
            Last Physical Count Shortage
          </div>
          <div className="text-2xl font-mono font-bold mt-1">
            {latestCount ? `${mgToGrams(latestCount.shortFineMg ?? 0)} g` : "No count yet"}
          </div>
          {latestCount?.completedAt && (
            <div className="text-xs text-muted-foreground mt-1">
              Counted {fmtDate(latestCount.completedAt)}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 mt-4">
        {!latestCount ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> No completed Physical Stock Count exists yet — run
            one from Stock → Verification to reconcile the vault.
          </div>
        ) : (latestCount.shortFineMg ?? 0) <= 0 ? (
          <div className="text-sm text-emerald-500 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> No shortage found in the last physical count — book
            and physical agree.
          </div>
        ) : (
          <div className="text-sm text-amber-500 flex items-center gap-2">
            <Badge variant="outline" className="border-amber-500/40 text-amber-400">
              Exception
            </Badge>
            The last physical count found {mgToGrams(latestCount.shortFineMg ?? 0)}g short.{" "}
            {latestCount.adjustmentLedgerEntryId
              ? "Already posted as a Gold Ledger adjustment."
              : "Not yet posted to the Gold Ledger — complete the adjustment from Stock → Verification."}
          </div>
        )}
      </div>
    </div>
  );
}
