import { createFileRoute } from "@tanstack/react-router";
import { DedicatedPortalLoginPage } from "@/components/portal/DedicatedPortalLoginPage";

export const Route = createFileRoute("/supplier-login")({
  head: () => ({
    meta: [{ title: "Supplier Portal Login · AVS Gold ERP" }],
  }),
  component: SupplierLoginPage,
});

function SupplierLoginPage() {
  return (
    <DedicatedPortalLoginPage
      portalType="supplier"
      title="Supplier Portal"
      subtitle="Sign in with your email or mobile OTP to track your purchase vouchers, metal supplies, and settlements."
      destinationRoute="/supplier-portal"
    />
  );
}
