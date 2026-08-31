/**
 * Settings → Subscription & Billing.
 * Native Android V1: status only — no SaaS checkout / Razorpay.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { SubscriptionPanel } from "@/components/subscription-panel";
import { guardRoute } from "@/lib/permissions";
import { hideCommercialPaymentUi } from "@/lib/native/platform";
import { useSubscriptionAccess } from "@/lib/identity/subscription-access-service";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/settings/license")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Subscription & Billing · AVS ERP" }] }),
  component: SubscriptionSettingsPage,
});

function SubscriptionSettingsPage() {
  if (hideCommercialPaymentUi()) {
    return <NativeLicenseStatus />;
  }
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

function NativeLicenseStatus() {
  const { status, message, daysRemaining } = useSubscriptionAccess();
  return (
    <div className="p-4 md:p-8 max-w-lg mx-auto space-y-5">
      <PageHeader
        title="Access status"
        subtitle="Plan purchases are managed on the web/desktop console for the Android app."
      />
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Current status</p>
        <p className="font-semibold text-foreground">{status || "—"}</p>
        {daysRemaining != null ? (
          <p className="text-sm text-muted-foreground">{daysRemaining} day(s) remaining</p>
        ) : null}
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Need to renew or change plan? Use the AVS ERP web app, or contact support.
      </p>
      <Button variant="outline" asChild>
        <a href="mailto:support@arivahly.in">Contact support</a>
      </Button>
      <Button variant="ghost" asChild>
        <Link to="/settings">Back to settings</Link>
      </Button>
    </div>
  );
}
