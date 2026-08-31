import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PrintEngine } from "@/components/print-engine/PrintEngine";
import { useBillingDocumentById } from "@/lib/use-billing-document";
import { Loader2, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/billing/delivery-challan-print/$id")({
  head: () => ({ meta: [{ title: "Delivery Challan Print · AVS Gold ERP" }] }),
  component: DeliveryChallanPrintPage,
});

function DeliveryChallanPrintPage() {
  const { id } = useParams({ from: "/billing/delivery-challan-print/$id" });
  const { document: c, loading, error, retry } = useBillingDocumentById("delivery_challan", id);

  if (loading && !c) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-muted-foreground p-6">
        <div className="text-sm">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          Loading delivery challan preview...
        </div>
      </div>
    );
  }

  if (!c) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
        <div className="text-center space-y-3">
          <h1 className="font-serif text-2xl text-gold">Delivery challan not found</h1>
          {error ? (
            <Button variant="outline" className="gap-1.5" onClick={retry}>
              <RotateCcw className="h-4 w-4" /> Retry
            </Button>
          ) : null}
          <Link to="/billing/delivery-challans" className="text-gold underline">
            Back to Delivery Challans
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PrintEngine
      docType="delivery_challan"
      recordId={c.id}
      backUrl={`/billing/delivery-challans/${c.id}`}
    />
  );
}
