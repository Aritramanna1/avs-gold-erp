import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PrintEngine } from "@/components/print-engine/PrintEngine";
import { useBillingDocumentById } from "@/lib/use-billing-document";
import { Loader2, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/billing/estimate/$id")({
  head: () => ({ meta: [{ title: "Estimate · AVS Gold ERP" }] }),
  component: EstimateDetail,
});

function EstimateDetail() {
  const { id } = useParams({ from: "/billing/estimate/$id" });
  const { document: estimate, loading, error, retry } = useBillingDocumentById("estimate", id);

  if (loading && !estimate) {
    return (
      <div className="mx-auto max-w-md p-8 text-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
        Loading estimate...
      </div>
    );
  }

  if (!estimate)
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="font-serif text-2xl">Estimate not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error || "The requested estimate could not be found."}
        </p>
        {error ? (
          <Button className="mt-4 gap-1.5" variant="outline" onClick={retry}>
            <RotateCcw className="h-4 w-4" /> Retry
          </Button>
        ) : null}
        <Link to="/billing/estimates">
          <Button className="mt-4" variant="outline">
            Back to estimates
          </Button>
        </Link>
      </div>
    );
  return (
    <PrintEngine docType="estimate_doc" recordId={estimate.id} backUrl="/billing/estimates/" />
  );
}
