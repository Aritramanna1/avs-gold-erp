/**
 * MVP-NAV (AVS-4 / AVS-32): firm operator primary chrome.
 * Home · Sell · Customers · Stock · Make · Money · Reports · More
 * Admin/Treasury mega titles are not primary.
 */
import type { LucideIcon } from "lucide-react";
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

export type FirmPrimaryNavSlot = {
  id: string;
  word: string;
  to: string;
  search?: Record<string, unknown>;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
};

export const FIRM_PRIMARY_NAV: readonly FirmPrimaryNavSlot[] = [
  {
    id: "home",
    word: "Home",
    to: "/app",
    icon: Home,
    match: (p) => p === "/app" || p === "/" || p === "/dashboard",
  },
  {
    id: "sell",
    word: "Sell",
    to: "/billing",
    icon: ShoppingCart,
    match: (p) =>
      p.startsWith("/billing") ||
      p.startsWith("/orders") ||
      p.startsWith("/catalog") ||
      p.startsWith("/crm") ||
      p.startsWith("/scheme") ||
      p.startsWith("/repair"),
  },
  {
    id: "customers",
    word: "Customers",
    to: "/people",
    search: { tab: "customers" },
    icon: UserRound,
    match: (p) => p.startsWith("/people"),
  },
  {
    id: "stock",
    word: "Stock",
    to: "/stock",
    icon: Package,
    match: (p) => p.startsWith("/stock") || p.startsWith("/barcode"),
  },
  {
    id: "make",
    word: "Make",
    to: "/workshop",
    icon: Hammer,
    match: (p) =>
      p.startsWith("/workshop") ||
      p.startsWith("/melt") ||
      p.startsWith("/settlement") ||
      p.startsWith("/manufacturing") ||
      p.startsWith("/refinery") ||
      p.startsWith("/mtg"),
  },
  {
    id: "money",
    word: "Money",
    to: "/ledger",
    icon: Wallet,
    match: (p) =>
      p.startsWith("/ledger") ||
      p.startsWith("/treasury") ||
      p.startsWith("/expenses") ||
      p.startsWith("/conversion") ||
      p.startsWith("/control/accounts") ||
      p.startsWith("/utilities"),
  },
  {
    id: "reports",
    word: "Reports",
    to: "/reports",
    icon: BarChart3,
    match: (p) => p.startsWith("/reports") || p.startsWith("/dashboard"),
  },
  {
    id: "more",
    word: "More",
    to: "/settings",
    icon: MoreHorizontal,
    match: (p) =>
      p.startsWith("/settings") ||
      p.startsWith("/control") ||
      p.startsWith("/hardware") ||
      p.startsWith("/communications") ||
      p.startsWith("/whatsapp") ||
      p.startsWith("/branches") ||
      p.startsWith("/ai-center") ||
      p.startsWith("/notifications") ||
      p.startsWith("/attendance") ||
      p.startsWith("/mobile/more") ||
      p.startsWith("/help") ||
      p.startsWith("/assistant"),
  },
] as const;

export function isFirmPrimaryPath(pathname: string): boolean {
  if (!pathname) return false;
  if (pathname.startsWith("/platform") || pathname.startsWith("/saas")) return false;
  return FIRM_PRIMARY_NAV.some((slot) => slot.match(pathname)) || pathname === "/app";
}
