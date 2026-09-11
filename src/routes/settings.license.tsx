/**
 * Settings — Subscription & Billing.
 * Native Android V1: status only — no SaaS checkout / Razorpay.
 * Web: handles ?payment=callback return_url hook (Phase B stubs).
 */
import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { SubscriptionPanel } from "@/components/subscription-panel";
import { PaymentResultBanner } from "@/components/billing/PaymentResultBanner";
import { guardRoute } from "@/lib/permissions";
import { hideCommercialPaymentUi } from "@/lib/native/platform";
import { useSubscriptionAccess } from "@/lib/identity/subscription-access-service";
import { Button } from "@/components/ui/button";
import {
  handlePaymentReturnFromSearch,
  isPaymentCallbackSearch,
} from "@/lib/platform-payments/payment-return";
import type { PaymentConfirmationState } from "@/hooks/use-payment-confirmation";
import { toast } from "sonner";

export const Route = createFileRoute("/settings/license")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Subscription & Billing · AVS ERP" }] }),
  component: SubscriptionSettingsPage,
});

function SubscriptionSettingsPage() {
  if (hideCommercialPaymentUi()) {
    return <NativeLicenseStatus />;
  }
  return <WebSubscriptionSettings />;
}

function WebSubscriptionSettings() {
  const [bannerState, setBannerState] = useState<PaymentConfirmationState>("idle");
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  useEffect(() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    if (!isPaymentCallbackSearch(search)) return;

    let cancelled = false;
    setBannerState("polling");
    setBannerMsg("Confirming your payment…");

    void (async () => {
      const result = await handlePaymentReturnFromSearch(search);
      if (cancelled) return;
      if (result.status === "verified") {
        setBannerState("confirmed");
        setBannerMsg("Payment verified. Entitlements will refresh shortly.");
        toast.success("Payment verified");
        return;
      }
      if (result.status === "failed") {
        setBannerState("failed");
        setBannerMsg(result.error);
        toast.error(result.error);
        return;
      }
      // callback land without Razorpay fields (modal path already verified)
      setBannerState("pending");
      setBannerMsg(
        "Returned from checkout. If you just paid, refresh in a moment if status is unchanged.",
      );
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Subscription & Billing"
        subtitle="Plans, payments, invoices, receipts, and usage credits — all in one secure place."
      />
      <PaymentResultBanner state={bannerState} message={bannerMsg} />
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
