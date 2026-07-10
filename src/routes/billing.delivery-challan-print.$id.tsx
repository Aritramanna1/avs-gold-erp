import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useDeliveryChallans } from "@/lib/billing-documents-store";
import { usePrintRecord } from "@/components/print/usePrintRecord";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import { PrintLayout } from "@/components/print/PrintLayout";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/billing/delivery-challan-print/$id")({
  head: () => ({ meta: [{ title: "Delivery Challan Print · AVS Gold ERP" }] }),
  component: DeliveryChallanPrintPage,
});

const STATUS_LABELS: Record<string, string> = {
  issued: "Issued",
  returned: "Returned",
  cancelled: "Cancelled",
  converted: "Converted",
};

function DeliveryChallanPrintPage() {
  const { id } = useParams({ from: "/billing/delivery-challan-print/$id" });
  const c = useDeliveryChallans((s) => s.challans.find((x) => x.id === id));

  const {
    docNumber,
    isReprint,
    reprintCount,
    reprintOpen,
    setReprintOpen,
    handlePrintTrigger,
    recordReprint,
  } = usePrintRecord(c ? "delivery_challan" : null, id);

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
    <div className="min-h-screen bg-background text-foreground">
      <PrintToolbar
        title="Delivery Challan"
        docNumber={docNumber}
        isReprint={isReprint}
        reprintCount={reprintCount}
        reprintOpen={reprintOpen}
        setReprintOpen={setReprintOpen}
        onPrint={handlePrintTrigger}
        onReprintConfirm={recordReprint}
        backUrl={`/billing/delivery-challans/${c.id}`}
      />

      <div className="flex-1 p-4 md:p-8 flex justify-center items-start overflow-y-auto">
        <PrintLayout
          title="DELIVERY CHALLAN"
          docNumber={docNumber}
          docType="delivery_challan"
          recordId={c.id}
          createdAt={c.createdAt}
          size="a4"
        >
          <div className="flex items-center gap-2 mb-4">
            <Badge variant="outline">{STATUS_LABELS[c.status] ?? c.status}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm mb-6">
            <div>
              <div className="text-xs uppercase text-stone-500">Customer</div>
              <div className="font-medium">{c.customerName}</div>
            </div>
          </div>

          <table className="w-full text-sm border-collapse mb-4">
            <thead>
              <tr className="border-b-2 border-amber-500 text-xs uppercase text-stone-500">
                <th className="text-left py-2">Item</th>
                <th className="text-center">Qty</th>
                <th className="text-center">Gross (g)</th>
              </tr>
            </thead>
            <tbody>
              {c.items.map((it, idx) => (
                <tr key={idx} className="border-b border-stone-100">
                  <td className="py-2">{it.itemName}</td>
                  <td className="text-center">{it.qty}</td>
                  <td className="text-center font-mono text-xs">
                    {(it.grossMg / 1000).toFixed(3)}g
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {c.notes && (
            <div className="mt-4 text-xs text-stone-500 border border-stone-200 rounded-md p-3">
              {c.notes}
            </div>
          )}

          <div className="mt-6 text-[10px] text-stone-400 text-center">
            Goods sent for {c.purpose.replace(/_/g, " ")} — not a tax invoice.
          </div>
        </PrintLayout>
      </div>
    </div>
  );
}
