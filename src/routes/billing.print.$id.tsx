import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useBilling } from "@/lib/billing-store";
import { useSettings } from "@/lib/settings-store";
import { shortShopName } from "@/lib/app-info";
import { Button } from "@/components/ui/button";
import { PrintEngine } from "@/components/print-engine/PrintEngine";

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
  const inv = useBilling((s) => s.invoices.find((i) => i.id === id));

  if (!inv) {
    return (
      <div className="p-8 text-rose-500 bg-background max-w-md mx-auto my-12 border border-rose-500/20 rounded-xl text-center space-y-3">
        <h2 className="text-lg font-serif font-semibold">Invoice Loading Failure</h2>
        <p className="text-xs text-muted-foreground">The requested invoice could not be found.</p>
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
