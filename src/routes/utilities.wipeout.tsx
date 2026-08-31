import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { SourceOfTruthBadge } from "@/components/ledger/SourceOfTruthBadge";

export const Route = createFileRoute("/utilities/wipeout")({
  head: () => ({ meta: [{ title: "Period Close · AVS ERP" }] }),
  component: WipeoutAliasPage,
});

function WipeoutAliasPage() {
  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Period Close (not Wipeout)"
        subtitle="Offline Wipeout is replaced — AVS never destroys gold_ledger or money SoT"
        actions={<SourceOfTruthBadge variant="ledger" />}
      />
      <div className="erp-surface rounded-xl p-5 space-y-4 border-amber-500/30">
        <p className="text-sm">
          Destructive Offline “wipeout” utilities are <strong>not</strong> available. Use
          period close, FY locks, and audit-safe cancellation instead.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/reports/month-end-close">Month-end close</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/reports/daily-close">Daily close</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/reports/auditor">Auditor / FY locks</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/reports/deleted-bills">Cancelled bills register</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
