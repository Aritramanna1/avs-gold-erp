import { createFileRoute } from "@tanstack/react-router";
import { PrintEngine } from "@/components/print-engine/PrintEngine";
import { useBillingDocumentById } from "@/lib/use-billing-document";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/billing/estimate-print/$id")({
  head: () => ({ meta: [{ title: "Estimate Print · AVS ERP" }] }),
  component: EstimatePrint,
});

function EstimatePrint() {
  const { id } = Route.useParams();
  const { document: estimate, loading, error, retry } = useBillingDocumentById("estimate", id);

  if (loading && !estimate) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
        Loading estimate print data...
      </div>
    );
  }

  if (!estimate) {
    return (
      <div className="p-8 text-center space-y-3">
        <p>Estimate not found.</p>
        {error ? (
          <Button variant="outline" className="gap-1.5" onClick={retry}>
            <RotateCcw className="h-4 w-4" /> Retry
          </Button>
        ) : null}
      </div>
    );
  }

  return <PrintEngine docType="estimate_doc" recordId={estimate.id} backUrl={`/billing/estimates/${id}`} />;
}
