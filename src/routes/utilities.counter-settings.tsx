import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { SourceOfTruthBadge } from "@/components/ledger/SourceOfTruthBadge";

export const Route = createFileRoute("/utilities/counter-settings")({
  head: () => ({ meta: [{ title: "Counter Settings · AVS ERP" }] }),
  component: CounterSettingsPage,
});

function CounterSettingsPage() {
  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Counter / Numbering"
        subtitle="Offline Counter Settings — branch document sequences and device counters"
        actions={<SourceOfTruthBadge variant="report" />}
      />
      <div className="erp-surface rounded-xl p-5 space-y-4">
        <p className="text-sm text-muted-foreground">
          AVS uses firm/branch numbering (not Offline per-form Counter_no clones). Configure
          sequences under Branches and Settings billing.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/branches">Branches</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/settings" search={{ tab: "billing" }}>
              Billing sequences
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/settings" search={{ tab: "hardware" }}>
              Hardware / Scale
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
