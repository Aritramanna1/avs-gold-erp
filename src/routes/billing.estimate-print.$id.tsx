import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { paiseToRupees } from "@/lib/billing-store";
import { useEstimates } from "@/lib/billing-documents-store";

export const Route = createFileRoute("/billing/estimate-print/$id")({
  head: () => ({ meta: [{ title: "Estimate Print · AVS Gold ERP" }] }),
  component: EstimatePrint,
});

function EstimatePrint() {
  const { id } = Route.useParams();
  const estimate = useEstimates((s) => s.estimates.find((row) => row.id === id));
  const refresh = useEstimates((s) => s.refresh);
  useEffect(() => void refresh(), [refresh]);
  if (!estimate) return <div className="p-8 text-center">Estimate not found.</div>;
  return (
    <main className="mx-auto max-w-3xl p-6 print:p-0">
      <div className="mb-4 flex justify-end gap-2 print:hidden">
        <Link to="/billing/estimates/$id" params={{ id }}>
          <Button variant="outline">Back</Button>
        </Link>
        <Button onClick={() => window.print()} className="gap-2">
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>
      <article className="rounded border border-border bg-white p-8 text-black print:border-0">
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
