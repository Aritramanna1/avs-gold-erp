import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Users, Wrench, Package, LayoutGrid } from "lucide-react";
import { MobileModulesSheet } from "@/components/mobile/MobileModulesSheet";

/**
 * Phone/tablet bottom rail — same information architecture as desktop
 * `navigationGroups` (Home → Parties → Manufacturing → Gold & Inventory → More).
 * "More" opens the full grouped module sheet (identical permissions as Sidebar).
 */
const TABS = [
  {
    to: "/app",
    label: "Home",
    icon: Home,
    match: (p: string) => p === "/app" || p === "/dashboard" || p.startsWith("/mtg"),
  },
  {
    to: "/people",
    label: "Parties",
    icon: Users,
    match: (p: string) => p.startsWith("/people") || p.startsWith("/communications"),
  },
  {
    to: "/manufacturing",
    label: "Mfg",
    icon: Wrench,
    match: (p: string) =>
      p.startsWith("/manufacturing") ||
      p.startsWith("/orders") ||
      p.startsWith("/workshop") ||
      p.startsWith("/melt") ||
      p.startsWith("/refinery") ||
      p.startsWith("/stock/hallmark"),
  },
  {
    to: "/stock",
    label: "Stock",
    icon: Package,
    match: (p: string) =>
      p.startsWith("/stock") ||
      p.startsWith("/ledger") ||
      p.startsWith("/conversion") ||
      p.startsWith("/barcode") ||
      p.startsWith("/catalog"),
  },
] as const;

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onPrimaryTab = TABS.some((tab) => tab.match(pathname));

  return (
    <nav className="mobile-bottom-nav lg:hidden" aria-label="Primary navigation">
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={`mobile-bottom-nav__item ${active ? "is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <Icon aria-hidden="true" />
            <span>{tab.label}</span>
          </Link>
        );
      })}
      <MobileModulesSheet
        triggerClassName={`mobile-bottom-nav__item ${!onPrimaryTab ? "is-active" : ""}`}
        triggerContent={
          <>
            <LayoutGrid aria-hidden="true" />
            <span>More</span>
          </>
        }
      />
    </nav>
  );
}
