import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { PrintEngine } from "@/components/print-engine/PrintEngine";
import { useBillingInvoiceById } from "@/lib/use-billing-invoice";
import { useBilling } from "@/lib/billing-store";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/lib/settings-store";
import { Loader2, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/billing/settlement-slip/$id")({
  head: () => {
    const shopName = useSettings.getState().firm?.shopName;
    return { meta: [{ title: `Customer Settlement Slip · ${shopName ?? "AVS ERP"}` }] };
  },
  component: SettlementSlipPrint,
});

function SettlementSlipPrint() {
  const { id } = useParams({ from: "/billing/settlement-slip/$id" });
  const { invoice: inv, loading, error, retry } = useBillingInvoiceById(id);

  useEffect(() => {
    if (inv) {
      const state = useBilling.getState();
      if (!state.invoices.some((i) => i.id === inv.id)) {
        useBilling.setState({ invoices: [inv, ...state.invoices] });
      }
    }
  }, [inv]);

  if (loading && !inv) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
        Loading settlement slip...
      </div>
    );
  }

  if (!inv) {
    return (
      <div className="p-8 space-y-3">
        <p>{error ?? "Invoice not found."}</p>
        {error ? (
          <Button variant="outline" className="gap-1.5" onClick={retry}>
            <RotateCcw className="h-4 w-4" /> Retry
          </Button>
        ) : null}
        <Link to="/billing">
          <Button variant="outline" className="text-xs">
            Back to Billing
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <PrintEngine docType="settlement_draft" recordId={inv.id} backUrl={`/billing/${inv.id}`} />
  );
}
