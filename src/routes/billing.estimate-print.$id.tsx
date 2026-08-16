import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Printer, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { paiseToRupees } from "@/lib/billing-store";
import { useBillingDocumentById } from "@/lib/use-billing-document";
import { printDocument } from "@/lib/print-document";

export const Route = createFileRoute("/billing/estimate-print/$id")({
  head: () => ({ meta: [{ title: "Estimate Print · AVS Gold ERP" }] }),
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
  return (
    <main className="mx-auto max-w-3xl p-6 print:p-0">
      <div className="mb-4 flex justify-end gap-2 print:hidden">
        <Link to="/billing/estimates/$id" params={{ id }}>
          <Button variant="outline">Back</Button>
        </Link>
        <Button onClick={() => void printDocument("Estimate", "Estimate")} className="gap-2">
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>
      <article
        data-testid="print-layout-root"
        className="rounded border border-border bg-white p-8 text-black print:border-0"
      >
        <h1 className="text-2xl font-semibold">Estimate / Quotation</h1>
        <p className="mt-1 font-mono text-sm">{estimate.estimateNo}</p>
        <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <p>
            <b>Customer:</b> {estimate.customerName}
          </p>
          <p>
            <b>Valid until:</b>{" "}
            {estimate.validUntilIso ? new Date(estimate.validUntilIso).toLocaleDateString() : "—"}
          </p>
        </div>
        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {estimate.items.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="py-2">{item.itemName}</td>
                <td className="py-2 text-right">₹ {paiseToRupees(item.lineTotalPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-6 text-right text-lg font-semibold">
          Total: ₹ {paiseToRupees(estimate.grandTotalPaise)}
        </p>
        <p className="mt-8 text-xs">This estimate is not a tax invoice.</p>
      </article>
    </main>
  );
}
