import { createFileRoute, Navigate } from "@tanstack/react-router";
import { MobileActionGrid } from "@/components/mobile/MobileActionGrid";
import { MOBILE_MORE_ACTIONS } from "@/lib/mobile/mobile-actions-catalog";
import { MobileModulesDirectory } from "@/components/mobile/MobileModulesSheet";
import { MobileLanguageSwitcher } from "@/components/mobile/MobileLanguageSwitcher";
import { usePhoneChrome } from "@/hooks/use-device-class";
import { isNativeApp, hideCommercialPaymentUi } from "@/lib/native/platform";
import { useLanguage } from "@/contexts/LanguageContext";

export const Route = createFileRoute("/mobile/more")({
  head: () => ({ meta: [{ title: "More · AVS ERP" }] }),
  component: MobileMorePage,
});

function MobileMorePage() {
  const isMobile = usePhoneChrome();
  const { t } = useLanguage();
  if (!isMobile) {
    return <Navigate to="/settings" replace />;
  }

  const actions = hideCommercialPaymentUi()
    ? MOBILE_MORE_ACTIONS.filter((a) => a.id !== "subscription")
    : MOBILE_MORE_ACTIONS;

  return (
    <div className="pb-24">
      <MobileActionGrid
        title={t("mobile.more")}
        subtitle={t("mobile.moreSubtitle")}
        actions={actions}
      />
      <section className="px-4 pb-4 max-w-lg mx-auto">
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <MobileLanguageSwitcher />
        </div>
      </section>
      <section className="px-4 pb-6 max-w-lg mx-auto">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
          {t("mobile.allModules")}
        </h2>
        <MobileModulesDirectory />
      </section>
    </div>
  );
}
