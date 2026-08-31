import { createFileRoute, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { RequireAction } from "@/components/role-gate";
import { BillingModule } from "@/modules/billing/BillingModule";

const SearchSchema = z.object({
  orderId: z.string().optional(),
  stockId: z.string().optional(),
  jobId: z.string().optional(),
});

export const Route = createFileRoute("/billing/new")({
  validateSearch: (s) => SearchSchema.parse(s),
  head: () => ({ meta: [{ title: "New Invoice · AVS Gold ERP" }] }),
  component: () => (
    <RequireAction action="billing.create" label="Create invoice">
      <NewInvoicePage />
    </RequireAction>
  ),
});

function NewInvoicePage() {
  const { orderId, stockId, jobId } = useSearch({ from: "/billing/new" });
  return <BillingModule orderId={orderId} stockId={stockId} jobId={jobId} />;
}
