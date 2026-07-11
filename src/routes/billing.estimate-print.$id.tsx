import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useEstimates } from "@/lib/billing-documents-store";
import { PrintEngine } from "@/components/print-engine/PrintEngine";

export const Route = createFileRoute("/billing/estimate-print/$id")({
  head: () => ({ meta: [{ title: "Estimate Print · AVS Gold ERP" }] }),
  component: EstimatePrintPage,
});

function EstimatePrintPage() {
  const { id } = useParams({ from: "/billing/estimate-print/$id" });
  const est = useEstimates((s) => s.estimates.find((e) => e.id === id));

  if (!est) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
        <div className="text-center space-y-3">
          <h1 className="font-serif text-2xl text-gold">Estimate not found</h1>
          <Link to="/billing/estimates" className="text-gold underline">
            Back to Estimates
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PrintEngine
      docType="estimate_doc"
      recordId={est.id}
      backUrl={`/billing/estimates/${est.id}`}
    />
  );
}
