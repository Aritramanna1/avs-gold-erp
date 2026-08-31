import { createFileRoute } from "@tanstack/react-router";
import { DedicatedPortalLoginPage } from "@/components/portal/DedicatedPortalLoginPage";

export const Route = createFileRoute("/customer-login")({
  head: () => ({
    meta: [{ title: "Customer Portal Login · AVS Gold ERP" }],
  }),
  component: CustomerLoginPage,
});

function CustomerLoginPage() {
  return (
    <DedicatedPortalLoginPage
      portalType="customer"
      title="Customer Portal"
      subtitle="Sign in with your email or mobile OTP to view your orders, invoices, gold wallet, and repairs."
      destinationRoute="/customer-portal"
    />
  );
}
