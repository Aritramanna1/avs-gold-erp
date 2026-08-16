import { createFileRoute, Navigate } from "@tanstack/react-router";
import { MobileActionGrid } from "@/components/mobile/MobileActionGrid";
import { MOBILE_MASTER_ACTIONS } from "@/lib/mobile/mobile-actions-catalog";
import { useIsMobileLayout } from "@/components/adaptive/AdaptiveView";

export const Route = createFileRoute("/master")({
  head: () => ({ meta: [{ title: "Master · AVS Gold ERP" }] }),
  component: MasterPage,
});

function MasterPage() {
  const isMobile = useIsMobileLayout();
  if (!isMobile) {
    return <Navigate to="/people" replace />;
  }
  return (
    <MobileActionGrid
      title="What do you want to do?"
      subtitle="Choose a master data action. You will go directly to the form."
      actions={MOBILE_MASTER_ACTIONS}
    />
  );
}
