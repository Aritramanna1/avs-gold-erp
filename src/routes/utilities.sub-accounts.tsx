import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { SourceOfTruthBadge } from "@/components/ledger/SourceOfTruthBadge";
import { BookOpen, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/utilities/sub-accounts")({
  head: () => ({ meta: [{ title: "Sub Accounts · AVS ERP" }] }),
  component: SubAccountsPage,
});

function SubAccountsPage() {
  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Sub Accounts"
        subtitle="Offline Sub Account — Chart of Accounts under Control"
        actions={<SourceOfTruthBadge variant="ledger" />}
      />

      <div className="erp-surface rounded-xl p-5 space-y-3">
        <p className="text-sm text-muted-foreground">
          Offline ERP “Sub Account” masters map to the AVS Chart of Accounts (CoA). Cash, bank, and
          control ledgers live under Control → Accounts — not a parallel local account book.
        </p>
        <ul className="list-disc pl-5 text-sm space-y-1">
          <li>Group / parent accounts for cash &amp; bank</li>
          <li>Party ledgers remain in People (Party 360)</li>
          <li>Postings use money vouchers + gold vault SoT</li>
        </ul>
      </div>

      <Link
        to="/control/accounts"
        className="erp-surface rounded-xl p-4 hover:border-primary/50 flex flex-col gap-2 max-w-md"
      >
        <BookOpen className="h-5 w-5 text-gold" />
        <span className="font-semibold text-sm">Chart of Accounts</span>
        <span className="text-xs text-muted-foreground">Control → Accounts (Offline Sub Account)</span>
        <ArrowRight className="h-4 w-4 text-muted-foreground mt-auto" />
      </Link>

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/control/accounts">Open CoA / Control Accounts</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/people">People (parties)</Link>
        </Button>
      </div>
    </div>
  );
}
