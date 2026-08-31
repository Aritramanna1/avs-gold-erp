import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { SourceOfTruthBadge } from "@/components/ledger/SourceOfTruthBadge";
import { Sparkles, Truck, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/workshop/vibrator")({
  head: () => ({ meta: [{ title: "Vibrator Out · AVS ERP" }] }),
  component: VibratorPage,
});

function VibratorPage() {
  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Vibrator Out"
        subtitle="Offline vibrator / polish-out — use Polishing and Outside Work on AVS"
        actions={<SourceOfTruthBadge variant="operational" />}
      />

      <div className="erp-surface rounded-xl p-5 space-y-3">
        <p className="text-sm text-muted-foreground">
          Vibrator Out is the Offline path for sending pieces to vibrator/polish processes. On AVS
          ERP this maps to Polishing books and Outside Work issue/receive — same gold vault and
          party books, no parallel vibrator ledger.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/workshop/polishing"
          className="erp-surface rounded-xl p-4 hover:border-primary/50 flex flex-col gap-2"
        >
          <Sparkles className="h-5 w-5 text-gold" />
          <span className="font-semibold text-sm">Polishing</span>
          <span className="text-xs text-muted-foreground">In-house / polish party books</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground mt-auto" />
        </Link>
        <Link
          to="/workshop/outside-work"
          className="erp-surface rounded-xl p-4 hover:border-primary/50 flex flex-col gap-2"
        >
          <Truck className="h-5 w-5 text-gold" />
          <span className="font-semibold text-sm">Outside Work (Vibrator Out)</span>
          <span className="text-xs text-muted-foreground">Issue / receive to outside process</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground mt-auto" />
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link to="/workshop/polishing-books">Polishing books</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/workshop/outside-worker-books">Outside worker books</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/workshop">Workshop hub</Link>
        </Button>
      </div>
    </div>
  );
}
