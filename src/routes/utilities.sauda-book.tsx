import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { SourceOfTruthBadge } from "@/components/ledger/SourceOfTruthBadge";
import { ArrowRight, Scale, Receipt, ArrowLeftRight } from "lucide-react";

/**
 * Offline ERP Sauda / Bullion register — AVS maps deals through canonical SoT:
 * Rate Master → Purchase/Sale → Gold Settlement / Gold Vault.
 * No browser-local deal book (would be a second source of truth).
 */
export const Route = createFileRoute("/utilities/sauda-book")({
  head: () => ({ meta: [{ title: "Sauda / Bullion · AVS ERP" }] }),
  component: SaudaBookPage,
});

function SaudaBookPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Sauda / Bullion"
        subtitle="Offline Sauda Book workflow on AVS ERP — rates, metal deals, and settlement post only to Gold Vault and money vouchers."
        actions={<SourceOfTruthBadge variant="ledger" />}
      />

      <div className="erp-surface rounded-xl p-5 space-y-3 max-w-2xl">
        <p className="text-sm text-muted-foreground">
          Record bullion / sauda deals the same way Offline operators did — but every fine and
          cash effect must land in the canonical AVS ledgers. Use the steps below; do not keep a
          separate local sauda register.
        </p>
        <ol className="list-decimal list-inside text-sm space-y-2 text-foreground">
          <li>Set or confirm today’s metal rates (Rate Master).</li>
          <li>Book the deal as Purchase or Sale with Gr / Less / Net / Tanch / Wstg / Hisob / Fine.</li>
          <li>Settle party fine + cash hisab when the deal closes (Settlement).</li>
        </ol>
      </div>

      <div className="grid gap-3 md:grid-cols-3 max-w-3xl">
        <Link
          to="/control/rates"
          className="erp-surface rounded-xl p-4 hover:border-primary/50 flex flex-col gap-2"
        >
          <Scale className="h-5 w-5 text-gold" />
          <span className="font-semibold text-sm">Rate Master</span>
          <span className="text-xs text-muted-foreground">Daily bullion / metal rates</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground mt-auto" />
        </Link>
        <Link
          to="/billing/purchases"
          className="erp-surface rounded-xl p-4 hover:border-primary/50 flex flex-col gap-2"
        >
          <Receipt className="h-5 w-5 text-gold" />
          <span className="font-semibold text-sm">Purchase / Sale</span>
          <span className="text-xs text-muted-foreground">Metal deal → invoice / purchase</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground mt-auto" />
        </Link>
        <Link
          to="/settlement/new"
          className="erp-surface rounded-xl p-4 hover:border-primary/50 flex flex-col gap-2"
        >
          <ArrowLeftRight className="h-5 w-5 text-gold" />
          <span className="font-semibold text-sm">Settlement</span>
          <span className="text-xs text-muted-foreground">Close party fine + cash hisab</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground mt-auto" />
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/billing">Open Sale / Invoice</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/ledger">Gold & Material Ledger</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/utilities">All Offline utilities</Link>
        </Button>
      </div>
    </div>
  );
}
