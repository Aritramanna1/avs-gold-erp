/**
 * Platform Owner sidebar — single source of truth for routes and active-state keys.
 * Each item has a unique `id`; active matching uses pathname + exact search params.
 */
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  Building2,
  CreditCard,
  FileText,
  Globe,
  GraduationCap,
  Headphones,
  LayoutDashboard,
  LifeBuoy,
  Package,
  Receipt,
  Settings2,
  ShieldCheck,
  UserCircle,
  Users,
} from "lucide-react";

export type PlatformNavItem = {
  /** Unique nav identity — never reused */
  id: string;
  label: string;
  pathname: string;
  search?: Record<string, string>;
  icon: LucideIcon;
};

export type PlatformNavGroup = {
  id: string;
  title: string;
  items: PlatformNavItem[];
};

/** Canonical Owner Panel navigation (V1 stabilization). */
export const platformOwnerNav: PlatformNavGroup[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    items: [
      {
        id: "dashboard-overview",
        label: "Dashboard",
        pathname: "/platform",
        search: { view: "overview" },
        icon: LayoutDashboard,
      },
    ],
  },
  {
    id: "tenant-management",
    title: "Tenant Management",
    items: [
      {
        id: "tenants-all",
        label: "All Tenants",
        pathname: "/platform",
        search: { view: "firms", filter: "all" },
        icon: Building2,
      },
      {
        id: "tenants-active",
        label: "Active Tenants",
        pathname: "/platform",
        search: { view: "firms", filter: "active" },
        icon: Users,
      },
      {
        id: "tenants-suspended",
        label: "Suspended Tenants",
        pathname: "/platform",
        search: { view: "firms", filter: "suspended" },
        icon: AlertTriangle,
      },
      {
        id: "tenants-360",
        label: "Tenant 360",
        pathname: "/platform",
        search: { view: "firms", filter: "all", panel: "360" },
        icon: Building2,
      },
    ],
  },
  {
    id: "onboarding-trials",
    title: "Onboarding & Trials",
    items: [
      {
        id: "onboarding",
        label: "Onboarding",
        pathname: "/platform/trials",
        search: { tab: "onboarding" },
        icon: GraduationCap,
      },
      {
        id: "trials-active",
        label: "Active Trials",
        pathname: "/platform/trials",
        search: { filter: "active" },
        icon: GraduationCap,
      },
      {
        id: "trials-expiring",
        label: "Expiring Trials",
        pathname: "/platform/trials",
        search: { filter: "expiring" },
        icon: AlertTriangle,
      },
    ],
  },
  {
    id: "products-plans",
    title: "Products & Plans",
    items: [
      {
        id: "products",
        label: "Products",
        pathname: "/platform/plans",
        search: { tab: "products" },
        icon: Package,
      },
      {
        id: "plans",
        label: "Plans",
        pathname: "/platform/plans",
        search: { tab: "plans" },
        icon: ShieldCheck,
      },
      {
        id: "addons",
        label: "Add-ons",
        pathname: "/platform/plans",
        search: { tab: "addons" },
        icon: Package,
      },
      {
        id: "plan-verification",
        label: "Plan Verification",
        pathname: "/platform/plans",
        search: { tab: "verification" },
        icon: FileText,
      },
    ],
  },
  {
    id: "billing-payments",
    title: "Billing & Payments",
    items: [
      {
        id: "billing-quotations",
        label: "Quotations",
        pathname: "/platform",
        search: { view: "billing", billingTab: "quotations" },
        icon: FileText,
      },
      {
        id: "billing-invoices",
        label: "Invoices",
        pathname: "/platform",
        search: { view: "billing", billingTab: "invoices" },
        icon: Receipt,
      },
      {
        id: "billing-payments",
        label: "Payments",
        pathname: "/platform",
        search: { view: "billing", billingTab: "payments" },
        icon: CreditCard,
      },
      {
        id: "billing-subscriptions",
        label: "Subscriptions",
        pathname: "/platform",
        search: { view: "subscriptions" },
        icon: CreditCard,
      },
      {
        id: "billing-licenses",
        label: "Licenses",
        pathname: "/platform",
        search: { view: "licenses" },
        icon: ShieldCheck,
      },
    ],
  },
  {
    id: "platform-config",
    title: "Platform Configuration",
    items: [
      {
        id: "config-website",
        label: "Website Manager",
        pathname: "/platform/website",
        icon: Globe,
      },
      {
        id: "config-branding",
        label: "Branding",
        pathname: "/platform",
        search: { view: "settings", settingsTab: "branding" },
        icon: Settings2,
      },
      {
        id: "config-documents",
        label: "Document Settings",
        pathname: "/platform",
        search: { view: "settings", settingsTab: "documents" },
        icon: FileText,
      },
      {
        id: "config-platform",
        label: "Platform Settings",
        pathname: "/platform",
        search: { view: "settings", settingsTab: "platform" },
        icon: Settings2,
      },
      {
        id: "config-razorpay",
        label: "Razorpay",
        pathname: "/platform",
        search: { view: "settings", settingsTab: "razorpay" },
        icon: CreditCard,
      },
    ],
  },
  {
    id: "support",
    title: "Support",
    items: [
      {
        id: "support-help",
        label: "Help / Knowledge Base",
        pathname: "/platform",
        search: { view: "help" },
        icon: LifeBuoy,
      },
      {
        id: "support-tickets",
        label: "Support Requests",
        pathname: "/platform",
        search: { view: "tickets" },
        icon: Headphones,
      },
    ],
  },
  {
    id: "system",
    title: "System",
    items: [
      {
        id: "system-users",
        label: "Users / Admin Accounts",
        pathname: "/platform",
        search: { view: "users" },
        icon: Users,
      },
      {
        id: "system-audit",
        label: "Audit Logs",
        pathname: "/platform",
        search: { view: "activity" },
        icon: Activity,
      },
      {
        id: "system-health",
        label: "Security & Health",
        pathname: "/platform",
        search: { view: "health" },
        icon: ShieldCheck,
      },
      {
        id: "system-account",
        label: "My Account",
        pathname: "/platform",
        search: { view: "account" },
        icon: UserCircle,
      },
    ],
  },
];

export function normalizePlatformSearch(
  raw: Record<string, unknown> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (v !== undefined && v !== null && v !== "") out[k] = String(v);
  }
  return out;
}

/** True only when pathname and every declared search param match exactly. */
export function isPlatformNavItemActive(
  item: PlatformNavItem,
  pathname: string,
  search: Record<string, string>,
): boolean {
  const normalizedPath =
    pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  const itemPath =
    item.pathname.endsWith("/") && item.pathname.length > 1
      ? item.pathname.slice(0, -1)
      : item.pathname;

  if (itemPath === "/platform") {
    if (normalizedPath !== "/platform") return false;
    const effectiveSearch = { ...search };
    if (!effectiveSearch.view) effectiveSearch.view = "overview";
    if (!item.search) {
      return (
        effectiveSearch.view === "overview" &&
        !effectiveSearch.filter &&
        !effectiveSearch.billingTab &&
        !effectiveSearch.settingsTab
      );
    }
    for (const [key, value] of Object.entries(item.search)) {
      if ((effectiveSearch[key] ?? "") !== value) return false;
    }
    return true;
  }

  if (normalizedPath !== itemPath && !normalizedPath.startsWith(`${itemPath}/`)) {
    return false;
  }

  if (!item.search || Object.keys(item.search).length === 0) {
    return true;
  }

  for (const [key, value] of Object.entries(item.search)) {
    if ((search[key] ?? "") !== value) return false;
  }
  return true;
}

export function findNavGroupForItem(itemId: string): string | null {
  for (const group of platformOwnerNav) {
    if (group.items.some((i) => i.id === itemId)) return group.id;
  }
  return null;
}
