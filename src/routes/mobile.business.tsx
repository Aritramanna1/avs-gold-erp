import { createFileRoute, Navigate } from "@tanstack/react-router";
import { MobileActionGrid } from "@/components/mobile/MobileActionGrid";
import { MOBILE_BUSINESS_ACTIONS } from "@/lib/mobile/mobile-actions-catalog";
import { usePhoneChrome } from "@/hooks/use-device-class";
import { useLanguage } from "@/contexts/LanguageContext";

export const Route = createFileRoute("/mobile/business")({
  head: () => ({ meta: [{ title: "Business · AVS ERP" }] }),
  component: MobileBusinessPage,
});

function MobileBusinessPage() {
  const isMobile = usePhoneChrome();
  const { t } = useLanguage();
  if (!isMobile) {
    return <Navigate to="/billing" replace />;
  }
  return (
    <MobileActionGrid
      title={t("mobile.businessTitle")}
      subtitle={t("mobile.businessSubtitle")}
      actions={MOBILE_BUSINESS_ACTIONS}
    />
  );
}
