/**
 * Order Print Route (Order Slip, Gold Receipt, Advance Receipt, Old Gold Receipt) — Unified Print Engine.
 */
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useOrders } from "@/lib/orders-store";
import type { PrintDocType } from "@/lib/printlog-store";
import { PrintEngine } from "@/components/print-engine/PrintEngine";
import { useSettings } from "@/lib/settings-store";
import { shortShopName } from "@/lib/app-info";

export const Route = createFileRoute("/orders/print/$kind/$id")({
  head: () => {
    const shortName = shortShopName(useSettings.getState().firm?.shopName);
    return {
      meta: [{ title: `Print · ${shortName} ERP` }],
    };
  },
  component: PrintPage,
});

type Kind = "slip" | "gold-receipt" | "advance-receipt" | "old-gold-receipt";

function PrintPage() {
  const params = useParams({ from: "/orders/print/$kind/$id" });
  const id = params.id;
  const KIND_ALIASES: Record<string, string> = {
    "customer-gold": "gold-receipt",
    "old-gold": "old-gold-receipt",
    advance: "advance-receipt",
  };
  const kind = KIND_ALIASES[params.kind] ?? params.kind;
  const order = useOrders((s) => s.orders.find((o) => o.id === id));

  const docTypeMap: Record<Kind, PrintDocType> = {
    slip: "order_slip",
    "gold-receipt": "gold_receipt",
    "advance-receipt": "advance_receipt",
    "old-gold-receipt": "old_gold_receipt",
  };

  if (!order) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
        <div className="text-center space-y-3">
          <h1 className="font-serif text-2xl text-gold">Order not found</h1>
          <Link to="/orders" className="text-gold underline">
            Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  const docType = docTypeMap[kind as Kind] ?? "order_slip";

  return <PrintEngine docType={docType} recordId={order.id} backUrl={`/orders/${order.id}`} />;
}
