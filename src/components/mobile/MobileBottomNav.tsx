import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Home,
  Hammer,
  MoreHorizontal,
  Package,
  ShoppingCart,
  UserRound,
  Wallet,
} from "lucide-react";
import { hapticLight } from "@/lib/native/haptics";

/** MVP-NAV phone chrome — same words as desktop primary. */
const TABS = [
  {
    to: "/app",
    word: "Home",
    icon: Home,
    match: (p: string) => p === "/app" || p === "/dashboard" || p === "/",
  },
  {
    to: "/billing",
    word: "Sell",
    icon: ShoppingCart,
    match: (p: string) =>
      p.startsWith("/billing") ||
      p.startsWith("/crm") ||
      p.startsWith("/catalog") ||
      p.startsWith("/orders") ||
      p.startsWith("/scheme") ||
      p.startsWith("/repair"),
  },
  {
    to: "/people",
    search: { tab: "customers" as const },
    word: "Customers",
    icon: UserRound,
    match: (p: string) => p.startsWith("/people"),
  },
  {
    to: "/stock",
    word: "Stock",
    icon: Package,
    match: (p: string) => p.startsWith("/stock") || p.startsWith("/barcode"),
  },
  {
    to: "/workshop",
    word: "Make",
    icon: Hammer,
    match: (p: string) =>
      p.startsWith("/workshop") ||
      p.startsWith("/melt") ||
      p.startsWith("/refinery") ||
      p.startsWith("/manufacturing") ||
      p.startsWith("/settlement"),
  },
  {
    to: "/ledger",
    word: "Money",
    icon: Wallet,
    match: (p: string) =>
      p.startsWith("/ledger") ||
      p.startsWith("/treasury") ||
      p.startsWith("/expenses") ||
      p.startsWith("/conversion") ||
      p.startsWith("/control/accounts"),
  },
  {
    to: "/reports",
    word: "Reports",
    icon: BarChart3,
    match: (p: string) => p.startsWith("/reports"),
  },
  {
    to: "/mobile/more",
    word: "More",
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

  return (
    <nav className="mobile-bottom-nav" data-device-chrome="phone" aria-label="Primary navigation">
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.word}
            to={tab.to as never}
            search={"search" in tab ? (tab.search as never) : (undefined as never)}
            onClick={() => void hapticLight()}
            className={`mobile-bottom-nav__item ${active ? "is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <Icon aria-hidden="true" />
            <span className="max-w-full px-0.5 text-center leading-tight break-words whitespace-normal">
              {tab.word}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
