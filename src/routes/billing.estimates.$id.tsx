import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Printer, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { paiseToRupees } from "@/lib/billing-store";
import { useBillingDocumentById } from "@/lib/use-billing-document";

export const Route = createFileRoute("/billing/estimates/$id")({
  head: () => ({ meta: [{ title: "Estimate · AVS Gold ERP" }] }),
  component: EstimateDetail,
});

function EstimateDetail() {
  const { id } = Route.useParams();
  const { document: estimate, loading, error, retry } = useBillingDocumentById("estimate", id);

  if (loading && !estimate) {
    return (
      <div className="mx-auto max-w-3xl p-8 text-sm text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
        Loading estimate...
      </div>
    );
  }
  if (!estimate) {
    return (
      <div className="mx-auto max-w-3xl p-8 text-center space-y-3">
        <p>Estimate not found.</p>
        {error ? (
          <Button variant="outline" className="gap-1.5" onClick={retry}>
            <RotateCcw className="h-4 w-4" /> Retry
          </Button>
        ) : null}
      </div>
    );
  }
  return (
    <main className="mx-auto max-w-4xl p-4 md:p-8">
      <PageHeader
        title={estimate.estimateNo}
        subtitle={`Estimate for ${estimate.customerName} · ${estimate.status}`}
        actions={
          <div className="flex gap-2">
            <Link to="/billing/estimates">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            </Link>
            <Link to="/billing/estimate-print/$id" params={{ id }}>
              <Button className="gap-2">
                <Printer className="h-4 w-4" /> Print
              </Button>
            </Link>
          </div>
        }
      />
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-5 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">Customer</span>
            <p>{estimate.customerName}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Valid until</span>
            <p>
              {estimate.validUntilIso ? new Date(estimate.validUntilIso).toLocaleDateString() : "—"}
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-2">Description</th>
                <th className="p-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {estimate.items.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="p-2">{item.itemName}</td>
                  <td className="p-2 text-right">₹ {paiseToRupees(item.lineTotalPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-5 ml-auto max-w-xs space-y-1 text-right text-sm">
          <p>Subtotal: ₹ {paiseToRupees(estimate.subtotalPaise)}</p>
          <p>GST: ₹ {paiseToRupees(estimate.gstPaise)}</p>
          <p className="border-t pt-2 text-base font-semibold">
            Total: ₹ {paiseToRupees(estimate.grandTotalPaise)}
          </p>
        </div>
        {estimate.notes && (
          <p className="mt-5 border-t pt-4 text-xs text-muted-foreground">{estimate.notes}</p>
        )}
      </section>
    </main>
  );
}
