import { createFileRoute, Navigate } from "@tanstack/react-router";
import { MobileActionGrid } from "@/components/mobile/MobileActionGrid";
import { MOBILE_WORK_ACTIONS } from "@/lib/mobile/mobile-actions-catalog";
import { usePhoneChrome } from "@/hooks/use-device-class";
import { useLanguage } from "@/contexts/LanguageContext";

export const Route = createFileRoute("/mobile/work")({
  head: () => ({ meta: [{ title: "Work · AVS ERP" }] }),
  component: MobileWorkPage,
});

function MobileWorkPage() {
  const isMobile = usePhoneChrome();
  const { t } = useLanguage();
  if (!isMobile) {
    return <Navigate to="/workshop" replace />;
  }
  return (
    <MobileActionGrid
      title={t("mobile.workTitle")}
      subtitle={t("mobile.workSubtitle")}
      actions={MOBILE_WORK_ACTIONS}
    />
  );
}
