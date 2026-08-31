import { createFileRoute } from "@tanstack/react-router";
import { DedicatedPortalLoginPage } from "@/components/portal/DedicatedPortalLoginPage";

export const Route = createFileRoute("/karigar-login")({
  head: () => ({
    meta: [{ title: "Karigar Portal Login · AVS Gold ERP" }],
  }),
  component: KarigarLoginPage,
});

function KarigarLoginPage() {
  return (
    <DedicatedPortalLoginPage
      portalType="karigar"
      title="Karigar Portal"
      subtitle="Sign in with your mobile number or email to view your active job cards, gold custody balance, and wages."
      destinationRoute="/karigar-portal"
    />
  );
}
