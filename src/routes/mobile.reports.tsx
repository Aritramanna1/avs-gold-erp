import { createFileRoute, Navigate } from "@tanstack/react-router";
import { MobileActionGrid } from "@/components/mobile/MobileActionGrid";
import { MOBILE_REPORTS_ACTIONS } from "@/lib/mobile/mobile-actions-catalog";
import { usePhoneChrome } from "@/hooks/use-device-class";
import { useLanguage } from "@/contexts/LanguageContext";

export const Route = createFileRoute("/mobile/reports")({
  head: () => ({ meta: [{ title: "Reports · AVS ERP" }] }),
  component: MobileReportsPage,
});

function MobileReportsPage() {
  const isMobile = usePhoneChrome();
  const { t } = useLanguage();
  if (!isMobile) {
    return <Navigate to="/reports" replace />;
  }
  return (
    <MobileActionGrid
      title={t("mobile.reportsTitle")}
      subtitle={t("mobile.reportsSubtitle")}
      actions={MOBILE_REPORTS_ACTIONS}
    />
  );
}
