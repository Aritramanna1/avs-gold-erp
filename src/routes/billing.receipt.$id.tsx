import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { PrintEngine } from "@/components/print-engine/PrintEngine";
import { useBillingInvoiceById } from "@/lib/use-billing-invoice";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/lib/settings-store";
import { shortShopName } from "@/lib/app-info";
import { Loader2, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/billing/receipt/$id")({
  head: () => {
    const shortName = shortShopName(useSettings.getState().firm?.shopName);
    return {
      meta: [{ title: `Payment Receipt · ${shortName} ERP` }],
    };
  },
  component: ReceiptPrint,
});

function ReceiptPrint() {
  const { id } = useParams({ from: "/billing/receipt/$id" });
  const { invoice: inv, loading, error, retry } = useBillingInvoiceById(id);

  if (loading && !inv) {
    return (
      <div className="p-8 text-sm text-muted-foreground text-center">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
        Loading receipt...
      </div>
    );
  }

  if (!inv) {
    return (
      <div className="p-8 space-y-3 max-w-md mx-auto text-center">
        <p className="text-destructive">{error ?? "Invoice not found."}</p>
        {error && (
          <Button variant="outline" className="gap-1.5" onClick={retry}>
            <RotateCcw className="h-4 w-4" /> Retry
          </Button>
        )}
        <Link to="/billing">
          <Button variant="outline">Back to Billing</Button>
        </Link>
      </div>
    );
  }

  return (
    <PrintEngine docType="payment_receipt" recordId={inv.id} backUrl={`/billing/${inv.id}`} />
  );
}
