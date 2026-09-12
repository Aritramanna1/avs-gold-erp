import { Link, useRouterState } from "@tanstack/react-router";
import { Home, ShoppingBag, Hammer, Landmark, MoreHorizontal } from "lucide-react";
import { hapticLight } from "@/lib/native/haptics";
import { useLanguage } from "@/contexts/LanguageContext";

/** AVS-57 leftover: Home · Sell · Make · Money · More (routes unchanged; no mega rewrite). */
const TABS = [
  {
    to: "/app",
    i18nKey: "mobile_home",
    icon: Home,
    match: (p: string) => p === "/app" || p === "/dashboard" || p === "/",
  },
  {
    to: "/billing",
    i18nKey: "mobile_sell",
    icon: ShoppingBag,
    match: (p: string) =>
      p.startsWith("/billing") ||
      p.startsWith("/crm") ||
      p.startsWith("/catalog") ||
      (p.startsWith("/people") && !p.includes("employees")),
  },
  {
    to: "/workshop",
    i18nKey: "mobile_make",
    icon: Hammer,
    match: (p: string) =>
      p.startsWith("/workshop") ||
      p.startsWith("/orders") ||
      p.startsWith("/melt") ||
      p.startsWith("/refinery") ||
      p.startsWith("/conversion") ||
      p.startsWith("/barcode") ||
      p.startsWith("/manufacturing") ||
      p.startsWith("/repair") ||
      p.startsWith("/stock"),
  },
  {
    to: "/ledger",
    i18nKey: "mobile_money",
    icon: Landmark,
    match: (p: string) =>
      p.startsWith("/ledger") ||
      p.startsWith("/control/accounts") ||
      p.startsWith("/treasury") ||
      p.startsWith("/settlement") ||
      p.startsWith("/reports"),
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
      p.startsWith("/notifications") ||
      p.startsWith("/customer-portal") ||
      p.startsWith("/karigar-portal") ||
      p.startsWith("/supplier-portal") ||
      p.startsWith("/verify"),
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
