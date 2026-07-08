import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useEstimates } from "@/lib/billing-documents-store";
import { paiseToRupees } from "@/lib/billing-store";
import { mgToGrams } from "@/lib/gold";
import { useSettings } from "@/lib/settings-store";
import { useCan } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Printer, Ban, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/billing/estimates/$id")({
  head: () => ({ meta: [{ title: "Estimate · AVS Gold ERP" }] }),
  component: EstimateDetail,
});

function EstimateDetail() {
  const { id } = useParams({ from: "/billing/estimates/$id" });
  const navigate = useNavigate();
  const estimates = useEstimates((s) => s.estimates);
  const refresh = useEstimates((s) => s.refresh);
  const cancel = useEstimates((s) => s.cancel);
  const convertToInvoice = useEstimates((s) => s.convertToInvoice);
  const { firm } = useSettings();
  const { can } = useCan();
  const est = estimates.find((e) => e.id === id);

  useEffect(() => {
    if (estimates.length === 0) refresh();
  }, [estimates.length, refresh]);

  const [converting, setConverting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  if (!est) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-center">
        <h1 className="font-serif text-2xl text-gold">Estimate not found</h1>
        <Link to="/billing/estimates" className="text-gold underline mt-4 inline-block">
          Back to Estimates
        </Link>
      </div>
    );
  }

  async function handleConvert() {
    setConverting(true);
    try {
      const result = await convertToInvoice(est!.id);
      if (result) {
        toast.success("Converted to invoice.");
        navigate({ to: "/billing/$id", params: { id: result.invoiceId } });
      } else {
        toast.error("Could not convert — estimate may already be converted or cancelled.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to convert estimate.");
    } finally {
      setConverting(false);
    }
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      await cancel(est!.id);
      toast.success("Estimate cancelled.");
    } catch (e: any) {
      toast.error(e?.message || "Failed to cancel estimate.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-100 p-4 md:p-8 print:bg-white print:p-0">
      <div className="flex gap-2 mb-4 print:hidden flex-wrap">
        <Link to="/billing/estimates">
          <Button variant="ghost" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> All Estimates
          </Button>
        </Link>
        <Button onClick={() => window.print()} className="gap-1.5">
          <Printer className="h-4 w-4" /> Print
        </Button>
        {est.status === "draft" && (
          <>
            <Button onClick={handleConvert} disabled={converting} className="gap-1.5">
              <ArrowRightLeft className="h-4 w-4" />
              {converting ? "Converting…" : "Convert to Invoice"}
            </Button>
            {can("billing.delete") && (
              <Button
                variant="destructive"
                className="gap-1.5"
                onClick={handleCancel}
                disabled={cancelling}
              >
                <Ban className="h-4 w-4" /> {cancelling ? "Cancelling…" : "Cancel Estimate"}
              </Button>
            )}
          </>
        )}
      </div>

      <div
        className="bg-white text-neutral-900 shadow-lg rounded-lg mx-auto print:shadow-none print:rounded-none p-10"
        style={{ maxWidth: 794, fontFamily: "'Helvetica Neue', Arial, sans-serif" }}
      >
        <div className="flex items-start justify-between border-b-4 border-amber-500 pb-4 mb-4">
          <div>
            <div className="text-xl font-bold text-amber-700">{firm.shopName.toUpperCase()}</div>
            {firm.address && <div className="text-xs text-neutral-500">{firm.address}</div>}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-amber-600">ESTIMATE</div>
            <div className="text-xs text-neutral-500 font-mono">{est.estimateNo}</div>
            <Badge variant="outline" className="mt-1">
              {est.status === "draft"
                ? "Draft"
                : est.status === "converted"
                  ? "Converted"
                  : est.status === "cancelled"
                    ? "Cancelled"
                    : "Expired"}
            </Badge>
          </div>
        </div>

        <div className="text-sm mb-4">
          <div className="text-xs uppercase text-neutral-400">Customer</div>
          <div className="font-medium">{est.customerName}</div>
          {est.customerPhone && <div className="text-xs text-neutral-500">{est.customerPhone}</div>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse mb-4">
            <thead>
              <tr className="border-b-2 border-amber-500 text-xs uppercase text-neutral-500">
                <th className="text-left py-2">Item</th>
                <th className="text-center">Fine (g)</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {est.items.map((it) => (
                <tr key={it.id} className="border-b border-neutral-100">
                  <td className="py-2">{it.itemName}</td>
                  <td className="text-center font-mono text-xs">{mgToGrams(it.fineMg)}g</td>
                  <td className="text-right">₹ {paiseToRupees(it.lineTotalPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <div className="w-64 text-sm">
            <div className="flex justify-between py-1 text-neutral-500">
              <span>Subtotal</span>
              <span>₹ {paiseToRupees(est.subtotalPaise)}</span>
            </div>
            {est.gstPaise > 0 && (
              <div className="flex justify-between py-1 text-neutral-500 text-xs">
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

        {est.notes && <div className="mt-4 text-xs text-neutral-500">{est.notes}</div>}
      </div>
    </div>
  );
}
