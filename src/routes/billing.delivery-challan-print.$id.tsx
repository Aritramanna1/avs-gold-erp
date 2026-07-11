import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useDeliveryChallans } from "@/lib/billing-documents-store";
import { PrintEngine } from "@/components/print-engine/PrintEngine";

export const Route = createFileRoute("/billing/delivery-challan-print/$id")({
  head: () => ({ meta: [{ title: "Delivery Challan Print · AVS Gold ERP" }] }),
  component: DeliveryChallanPrintPage,
});

function DeliveryChallanPrintPage() {
  const { id } = useParams({ from: "/billing/delivery-challan-print/$id" });
  const c = useDeliveryChallans((s) => s.challans.find((x) => x.id === id));

  if (!c) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
        <div className="text-center space-y-3">
          <h1 className="font-serif text-2xl text-gold">Delivery challan not found</h1>
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
