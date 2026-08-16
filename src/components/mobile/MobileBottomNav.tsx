import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Layers, Zap } from "lucide-react";

const TABS = [
  {
    to: "/app",
    label: "Home",
    icon: Home,
    match: (p: string) => p === "/app" || p === "/dashboard",
  },
  {
    to: "/master",
    label: "Master",
    icon: Layers,
    match: (p: string) => p === "/master",
  },
  {
    to: "/transaction-hub",
    label: "Transactions",
    icon: Zap,
    match: (p: string) => p === "/transaction-hub",
  },
] as const;

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      className="mobile-bottom-nav mobile-bottom-nav--three lg:hidden"
      aria-label="Primary navigation"
    >
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
    </nav>
  );
}
