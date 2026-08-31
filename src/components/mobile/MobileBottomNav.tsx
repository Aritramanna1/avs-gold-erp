import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Hammer, Briefcase, BarChart3, MoreHorizontal } from "lucide-react";
import { hapticLight } from "@/lib/native/haptics";
import { useLanguage } from "@/contexts/LanguageContext";

/** Offline ERP ops on mobile: Home · Production · Transaction · Reports · More */
const TABS = [
  {
    to: "/app",
    i18nKey: "mobile_home",
    icon: Home,
    match: (p: string) => p === "/app" || p === "/dashboard" || p === "/",
  },
  {
    to: "/mobile/work",
    i18nKey: "mobile_production",
    icon: Hammer,
    match: (p: string) =>
      p === "/workshop/gold-book" ||
      p === "/transactions" ||
      p === "/mobile/work" ||
      p === "/mobile/gold-stock" ||
      p.startsWith("/workshop") ||
      p.startsWith("/orders") ||
      p === "/master" ||
      p.startsWith("/melt") ||
      p.startsWith("/refinery") ||
      p.startsWith("/conversion") ||
      p.startsWith("/barcode") ||
      p.startsWith("/stock") ||
      p.startsWith("/manufacturing") ||
      p.startsWith("/repair"),
  },
  {
    to: "/mobile/business",
    i18nKey: "mobile_transaction",
    icon: Briefcase,
    match: (p: string) =>
      p === "/mobile/business" ||
      p === "/transaction-hub" ||
      p.startsWith("/billing") ||
      p.startsWith("/people") ||
      p.startsWith("/treasury") ||
      p.startsWith("/expenses") ||
      p.startsWith("/settlement") ||
      p.startsWith("/utilities") ||
      p.startsWith("/catalog") ||
      p.startsWith("/scheme"),
  },
  {
    to: "/mobile/reports",
    i18nKey: "mobile_reports",
    icon: BarChart3,
    match: (p: string) =>
      p === "/mobile/reports" ||
      p.startsWith("/reports") ||
      p.startsWith("/ledger") ||
      p.startsWith("/documents") ||
      p.startsWith("/dashboard"),
  },
  {
    to: "/mobile/more",
    i18nKey: "mobile_more",
    icon: MoreHorizontal,
    match: (p: string) =>
      p === "/mobile/more" ||
      p.startsWith("/settings") ||
      p.startsWith("/help") ||
      p.startsWith("/control") ||
      p.startsWith("/customization") ||
      p.startsWith("/assistant") ||
      p.startsWith("/communications") ||
      p.startsWith("/whatsapp") ||
      p.startsWith("/branches") ||
      p.startsWith("/attendance") ||
      p.startsWith("/hardware") ||
      p.startsWith("/notifications"),
  },
] as const;

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { t } = useLanguage();

  return (
    <nav className="mobile-bottom-nav" data-device-chrome="phone" aria-label="Primary navigation">
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.to}
            to={tab.to}
            onClick={() => void hapticLight()}
            className={`mobile-bottom-nav__item ${active ? "is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <Icon aria-hidden="true" />
            <span className="max-w-full px-0.5 text-center leading-tight break-words whitespace-normal">
              {t(`navigation.${tab.i18nKey}`)}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
