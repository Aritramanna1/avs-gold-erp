/**
 * Settings → Subscription & Billing. Replaces legacy licence-key activation.
 */
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { SubscriptionPanel } from "@/components/subscription-panel";
import { guardRoute } from "@/lib/permissions";

export const Route = createFileRoute("/settings/license")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Subscription & Billing · AVS Gold ERP" }] }),
  component: SubscriptionSettingsPage,
});

function SubscriptionSettingsPage() {
  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Subscription & Billing"
        subtitle="Plans, payments, invoices, receipts, and usage credits — all in one secure place."
      />
      <SubscriptionPanel />
    </div>
  );
}
