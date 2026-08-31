import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { SourceOfTruthBadge } from "@/components/ledger/SourceOfTruthBadge";
import { Package, Layers, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/utilities/patla-stock")({
  head: () => ({ meta: [{ title: "Patla Stock · AVS ERP" }] }),
  component: PatlaStockPage,
});

function PatlaStockPage() {
  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Patla Stock"
        subtitle="Offline Patla — lot subtype on AVS; no separate patla register"
        actions={<SourceOfTruthBadge variant="operational" />}
      />

      <div className="erp-surface rounded-xl p-5 space-y-3">
        <p className="text-sm text-muted-foreground">
          Patla stock in Offline ERP is a way to pick and manage sheet/lot metal. On AVS ERP, Patla
          is modeled as a <strong>lot subtype</strong> under Lot &amp; Batch Management — tags and
          ready stock remain the inventory SoT.
        </p>
        <ol className="list-decimal pl-5 text-sm space-y-1">
          <li>Create or open a lot (use notes/category to mark Patla if needed).</li>
          <li>Assign or receive tags into that lot from Ready Stock.</li>
          <li>Issue, transfer, or sell through normal stock flows.</li>
        </ol>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/stock/lots"
          className="erp-surface rounded-xl p-4 hover:border-primary/50 flex flex-col gap-2"
        >
          <Layers className="h-5 w-5 text-gold" />
          <span className="font-semibold text-sm">Lot &amp; Batch</span>
          <span className="text-xs text-muted-foreground">Patla as lot subtype</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground mt-auto" />
        </Link>
        <Link
          to="/stock"
          className="erp-surface rounded-xl p-4 hover:border-primary/50 flex flex-col gap-2"
        >
          <Package className="h-5 w-5 text-gold" />
          <span className="font-semibold text-sm">Ready Stock</span>
          <span className="text-xs text-muted-foreground">Tagged inventory</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground mt-auto" />
        </Link>
      </div>

      <Button variant="outline" size="sm" asChild>
        <Link to="/stock/entry">Stock entry</Link>
      </Button>
    </div>
  );
}
