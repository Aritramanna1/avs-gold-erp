import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEstimates } from "@/lib/billing-documents-store";
import { Button } from "@/components/ui/button";
import { PrintEngine } from "@/components/print-engine/PrintEngine";

export const Route = createFileRoute("/billing/estimate/$id")({
  head: () => ({ meta: [{ title: "Estimate · AVS Gold ERP" }] }),
  component: EstimateDetail,
});

function EstimateDetail() {
  const { id } = useParams({ from: "/billing/estimate/$id" });
  const estimate = useEstimates((s) => s.estimates.find((row) => row.id === id));
  if (!estimate)
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="font-serif text-2xl">Estimate not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Refresh the estimates list and try again.
        </p>
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
