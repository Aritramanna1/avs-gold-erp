import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useDeliveryChallans } from "@/lib/billing-documents-store";
import { useSettings } from "@/lib/settings-store";
import { useCan } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Printer, Ban, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/billing/delivery-challans/$id")({
  head: () => ({ meta: [{ title: "Delivery Challan · AVS Gold ERP" }] }),
  component: DeliveryChallanDetail,
});

function DeliveryChallanDetail() {
  const { id } = useParams({ from: "/billing/delivery-challans/$id" });
  const challans = useDeliveryChallans((s) => s.challans);
  const refresh = useDeliveryChallans((s) => s.refresh);
  const markReturned = useDeliveryChallans((s) => s.markReturned);
  const cancel = useDeliveryChallans((s) => s.cancel);
  const { firm } = useSettings();
  const { can } = useCan();
  const c = challans.find((x) => x.id === id);

  useEffect(() => {
    if (challans.length === 0) refresh();
  }, [challans.length, refresh]);

  const [busy, setBusy] = useState(false);

  if (!c) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-center">
        <h1 className="font-serif text-2xl text-gold">Delivery challan not found</h1>
        <Link to="/billing/delivery-challans" className="text-gold underline mt-4 inline-block">
          Back to Delivery Challans
        </Link>
      </div>
    );
  }

  async function handleReturn() {
    setBusy(true);
    try {
      await markReturned(c!.id);
      toast.success("Marked as returned.");
    } catch (e: any) {
      toast.error(e?.message || "Failed to update.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    setBusy(true);
    try {
      await cancel(c!.id);
      toast.success("Delivery challan cancelled.");
    } catch (e: any) {
      toast.error(e?.message || "Failed to cancel.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-100 p-4 md:p-8 print:bg-white print:p-0">
      <div className="flex gap-2 mb-4 print:hidden flex-wrap">
        <Link to="/billing/delivery-challans">
          <Button variant="ghost" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> All Delivery Challans
          </Button>
        </Link>
        <Button onClick={() => window.print()} className="gap-1.5">
          <Printer className="h-4 w-4" /> Print
        </Button>
        {c.status === "issued" && (
          <>
            <Button onClick={handleReturn} disabled={busy} className="gap-1.5">
              <CheckCircle className="h-4 w-4" /> Mark Returned
            </Button>
            {can("billing.delete") && (
              <Button
                variant="destructive"
                className="gap-1.5"
                onClick={handleCancel}
                disabled={busy}
              >
                <Ban className="h-4 w-4" /> Cancel
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
            <div className="text-2xl font-bold text-amber-600">DELIVERY CHALLAN</div>
            <div className="text-xs text-neutral-500 font-mono">{c.challanNo}</div>
            <Badge variant="outline" className="mt-1">
              {c.status === "issued"
                ? "Issued"
                : c.status === "returned"
                  ? "Returned"
                  : c.status === "cancelled"
                    ? "Cancelled"
                    : "Converted"}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm mb-6">
          <div>
            <div className="text-xs uppercase text-neutral-400">Customer</div>
            <div className="font-medium">{c.customerName}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-neutral-400">Date</div>
            <div>{new Date(c.createdAt).toLocaleDateString("en-IN")}</div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse mb-4">
            <thead>
              <tr className="border-b-2 border-amber-500 text-xs uppercase text-neutral-500">
                <th className="text-left py-2">Item</th>
                <th className="text-center">Qty</th>
                <th className="text-center">Gross (g)</th>
              </tr>
            </thead>
            <tbody>
              {c.items.map((it, idx) => (
                <tr key={idx} className="border-b border-neutral-100">
                  <td className="py-2">{it.itemName}</td>
                  <td className="text-center">{it.qty}</td>
                  <td className="text-center font-mono text-xs">
                    {(it.grossMg / 1000).toFixed(3)}g
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {c.notes && (
          <div className="mt-4 text-xs text-neutral-500 border border-neutral-200 rounded-md p-3">
            {c.notes}
          </div>
        )}

        <div className="mt-6 text-[10px] text-neutral-300 text-center">
          Goods sent for {c.purpose.replace(/_/g, " ")} — not a tax invoice.
        </div>
      </div>
    </div>
  );
}
