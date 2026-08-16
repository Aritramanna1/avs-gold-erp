import { createFileRoute, Navigate } from "@tanstack/react-router";
import { MobileActionGrid } from "@/components/mobile/MobileActionGrid";
import { MOBILE_TRANSACTION_ACTIONS } from "@/lib/mobile/mobile-actions-catalog";
import { useIsMobileLayout } from "@/components/adaptive/AdaptiveView";

export const Route = createFileRoute("/transaction-hub")({
  head: () => ({ meta: [{ title: "Transactions · AVS Gold ERP" }] }),
  component: TransactionHubPage,
});

function TransactionHubPage() {
  const isMobile = useIsMobileLayout();
  if (!isMobile) {
    return <Navigate to="/billing" replace />;
  }
  return (
    <MobileActionGrid
      title="What do you want to do?"
      subtitle="Choose a transaction. Category → action → form."
      actions={MOBILE_TRANSACTION_ACTIONS}
    />
  );
}
