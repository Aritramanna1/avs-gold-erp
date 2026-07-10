import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useEstimates } from "@/lib/billing-documents-store";
import { paiseToRupees } from "@/lib/billing-store";
import { mgToGrams } from "@/lib/gold";
import { usePrintRecord } from "@/components/print/usePrintRecord";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import { PrintLayout } from "@/components/print/PrintLayout";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/billing/estimate-print/$id")({
  head: () => ({ meta: [{ title: "Estimate Print · AVS Gold ERP" }] }),
  component: EstimatePrintPage,
});

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  converted: "Converted",
  cancelled: "Cancelled",
  expired: "Expired",
};

function EstimatePrintPage() {
  const { id } = useParams({ from: "/billing/estimate-print/$id" });
  const est = useEstimates((s) => s.estimates.find((e) => e.id === id));

  const {
    docNumber,
    isReprint,
    reprintCount,
    reprintOpen,
    setReprintOpen,
    handlePrintTrigger,
    recordReprint,
  } = usePrintRecord(est ? "estimate_doc" : null, id);

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
    <div className="min-h-screen bg-background text-foreground">
      <PrintToolbar
        title="Estimate"
        docNumber={docNumber}
        isReprint={isReprint}
        reprintCount={reprintCount}
        reprintOpen={reprintOpen}
        setReprintOpen={setReprintOpen}
        onPrint={handlePrintTrigger}
        onReprintConfirm={recordReprint}
        backUrl={`/billing/estimates/${est.id}`}
      />

      <div className="flex-1 p-4 md:p-8 flex justify-center items-start overflow-y-auto">
        <PrintLayout
          title="ESTIMATE"
          docNumber={docNumber}
          docType="estimate_doc"
          recordId={est.id}
          createdAt={est.createdAt}
          size="a4"
        >
          <div className="flex items-center gap-2 mb-4">
            <Badge variant="outline">{STATUS_LABELS[est.status] ?? est.status}</Badge>
          </div>

          <div className="text-sm mb-4">
            <div className="text-xs uppercase text-stone-500">Customer</div>
            <div className="font-medium">{est.customerName}</div>
            {est.customerPhone && <div className="text-xs text-stone-500">{est.customerPhone}</div>}
          </div>

          <table className="w-full text-sm border-collapse mb-4">
            <thead>
              <tr className="border-b-2 border-amber-500 text-xs uppercase text-stone-500">
                <th className="text-left py-2">Item</th>
                <th className="text-center">Fine (g)</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {est.items.map((it) => (
                <tr key={it.id} className="border-b border-stone-100">
                  <td className="py-2">{it.itemName}</td>
                  <td className="text-center font-mono text-xs">{mgToGrams(it.fineMg)}g</td>
                  <td className="text-right">₹ {paiseToRupees(it.lineTotalPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-64 text-sm">
              <div className="flex justify-between py-1 text-stone-500">
                <span>Subtotal</span>
                <span>₹ {paiseToRupees(est.subtotalPaise)}</span>
              </div>
              {est.gstPaise > 0 && (
                <div className="flex justify-between py-1 text-stone-500 text-xs">
                  <span>GST</span>
                  <span>₹ {paiseToRupees(est.gstPaise)}</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-t-2 border-amber-500 mt-1 font-bold">
                <span>Grand Total</span>
                <span className="text-amber-700">₹ {paiseToRupees(est.grandTotalPaise)}</span>
              </div>
            </div>
          </div>

          {est.notes && <div className="mt-4 text-xs text-stone-500">{est.notes}</div>}
        </PrintLayout>
      </div>
    </div>
  );
}
