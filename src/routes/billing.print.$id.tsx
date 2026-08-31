import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useSettings } from "@/lib/settings-store";
import { shortShopName } from "@/lib/app-info";
import { Button } from "@/components/ui/button";
import { PrintEngine } from "@/components/print-engine/PrintEngine";
import { useBillingInvoiceById } from "@/lib/use-billing-invoice";
import { Loader2, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/billing/print/$id")({
  head: () => {
    const shortName = shortShopName(useSettings.getState().firm?.shopName);
    return {
      meta: [{ title: `Invoice Print · ${shortName} ERP` }],
    };
  },
  component: InvoicePrint,
});

function InvoicePrint() {
  const { id } = useParams({ from: "/billing/print/$id" });
  const { invoice: inv, loading, error, retry } = useBillingInvoiceById(id);

  if (loading && !inv) {
    return (
      <div className="p-8 bg-background max-w-md mx-auto my-12 border border-border rounded-md text-center space-y-3">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Loading invoice print data...</p>
      </div>
    );
  }

  if (!inv) {
    return (
      <div className="p-8 text-rose-500 bg-background max-w-md mx-auto my-12 border border-rose-500/20 rounded-md text-center space-y-3">
        <h2 className="text-lg font-serif font-semibold">Invoice Loading Failure</h2>
        <p className="text-xs text-muted-foreground">
          {error ?? "The requested invoice could not be found."}
        </p>
        {error ? (
          <Button variant="outline" className="mt-4 text-xs gap-1.5" onClick={retry}>
            <RotateCcw className="h-3.5 w-3.5" /> Retry
          </Button>
        ) : null}
        <Link to="/billing">
          <Button variant="outline" className="mt-4 text-xs">
            Back to Billing
          </Button>
        </Link>
      </div>
    );
  }

  const docType = inv.gst === "gst3" ? "gst_invoice" : "retail_invoice";

  return <PrintEngine docType={docType} recordId={inv.id} backUrl={`/billing/${inv.id}`} />;
}
