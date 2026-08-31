import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { SourceOfTruthBadge } from "@/components/ledger/SourceOfTruthBadge";
import { ArrowRight, ClipboardList, Users, Receipt, FileBarChart } from "lucide-react";

export const Route = createFileRoute("/scheme/")({
  head: () => ({ meta: [{ title: "Scheme · AVS ERP" }] }),
  component: SchemeHubPage,
});

function SchemeHubPage() {
  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Scheme / Chit"
        subtitle="Installment plans, party enrollment, receipts — cash posts through money vouchers"
        actions={<SourceOfTruthBadge variant="ledger" />}
      />

      <div className="erp-surface rounded-xl p-5 space-y-2">
        <p className="text-sm text-muted-foreground">
          Offline Scheme Master on AVS: plans and accounts are firm-scoped registers. Installment
          receipts post to the universal money ledger (no second cash book).
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          to={"/scheme/plans"}
          className="erp-surface rounded-xl p-4 hover:border-primary/50 flex flex-col gap-2"
        >
          <ClipboardList className="h-5 w-5 text-gold" />
          <span className="font-semibold text-sm">Scheme Plans</span>
          <span className="text-xs text-muted-foreground">Duration, installment, bonus</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground mt-auto" />
        </Link>
        <Link
          to={"/scheme/accounts"}
          className="erp-surface rounded-xl p-4 hover:border-primary/50 flex flex-col gap-2"
        >
          <Users className="h-5 w-5 text-gold" />
          <span className="font-semibold text-sm">Scheme Accounts</span>
          <span className="text-xs text-muted-foreground">Enroll party into a plan</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground mt-auto" />
        </Link>
        <Link
          to={"/scheme/receipts"}
          className="erp-surface rounded-xl p-4 hover:border-primary/50 flex flex-col gap-2"
        >
          <Receipt className="h-5 w-5 text-gold" />
          <span className="font-semibold text-sm">Installment Receipts</span>
          <span className="text-xs text-muted-foreground">Post scheme cash receipt</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground mt-auto" />
        </Link>
        <Link
          to={"/reports/scheme"}
          className="erp-surface rounded-xl p-4 hover:border-primary/50 flex flex-col gap-2"
        >
          <FileBarChart className="h-5 w-5 text-gold" />
          <span className="font-semibold text-sm">Scheme Report</span>
          <span className="text-xs text-muted-foreground">Plans, accounts, receipts register</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground mt-auto" />
        </Link>
      </div>

      <Button variant="outline" size="sm" asChild>
        <Link to="/utilities">All Offline utilities</Link>
      </Button>
    </div>
  );
}
