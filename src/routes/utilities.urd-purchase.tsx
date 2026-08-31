import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { SourceOfTruthBadge } from "@/components/ledger/SourceOfTruthBadge";

export const Route = createFileRoute("/utilities/urd-purchase")({
  head: () => ({ meta: [{ title: "URD Purchase · AVS ERP" }] }),
  component: UrdPurchasePage,
});

function UrdPurchasePage() {
  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="URD / Old Gold Purchase"
        subtitle="Offline retail URD — buy customer old gold into vault with party credit"
        actions={<SourceOfTruthBadge variant="ledger" />}
      />
      <div className="erp-surface rounded-xl p-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          AVS posts URD through the same gold vault and party books as Offline ERP (no second
          metal ledger). Use either path:
        </p>
        <ol className="list-decimal pl-5 text-sm space-y-2">
          <li>
            <strong>Order intake</strong> — receive old gold on an order (touch, less, fine credit).
          </li>
          <li>
            <strong>Supplier / metal purchase</strong> — bullion or scrap purchase into vault.
          </li>
          <li>
            <strong>Gold Settlement</strong> — settle party fine + cash hisab after assay.
          </li>
        </ol>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button asChild>
            <Link to="/orders/new">New order (old gold)</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/billing/purchases">Purchases</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/settlement/new">Gold Settlement</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/ledger">Gold Vault</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
