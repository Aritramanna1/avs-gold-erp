import type { LucideIcon } from "lucide-react";
import {
  Home,
  Users,
  User,
  Truck,
  Hammer,
  Briefcase,
  MessageSquare,
  ShoppingBag,
  Wrench,
  BookOpen,
  BadgeCheck,
  FlameKindling,
  Package,
  ScanLine,
  Scale,
  ArrowLeftRight,
  Receipt,
  TrendingDown,
  Landmark,
  BarChart3,
  FileSpreadsheet,
  Sliders,
  Settings as SettingsIcon,
  LifeBuoy,
  Building2,
  Mail,
  Gem,
} from "lucide-react";

export type NavItemDef = {
  to: string;
  label: string;
  icon: LucideIcon;
  search?: Record<string, string>;
};

export type NavGroupDef = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItemDef[];
};

/** Grouped ERP navigation (~7 collapsible sections). Portal shortcuts excluded. */
export const navigationGroups: NavGroupDef[] = [
  {
    id: "home",
    label: "Home",
    icon: Home,
    items: [{ to: "/app", label: "Dashboard", icon: Home }],
  },
  {
    id: "parties",
    label: "Parties & Business",
    icon: Users,
    items: [
      { to: "/people", label: "Customers", icon: User, search: { tab: "customers" } },
      { to: "/people", label: "Suppliers", icon: Truck, search: { tab: "vendors" } },
      { to: "/people", label: "Karigars", icon: Hammer, search: { tab: "karigars" } },
      { to: "/people", label: "Employees", icon: Briefcase, search: { tab: "employees" } },
      { to: "/communications", label: "CRM & Communications", icon: MessageSquare },
    ],
  },
  {
    id: "manufacturing",
    label: "Manufacturing",
    icon: Wrench,
    items: [
      { to: "/orders", label: "Orders", icon: ShoppingBag },
      { to: "/manufacturing", label: "Job Cards & Production", icon: Wrench },
      { to: "/workshop", label: "Manufacturing Books", icon: BookOpen },
      { to: "/workshop/gold-book", label: "Worker Gold Book", icon: BookOpen },
      { to: "/workshop/outside-work", label: "Outside Work", icon: Wrench },
      { to: "/stock/hallmark", label: "QC / Hallmark", icon: BadgeCheck },
      { to: "/melt", label: "Melt & Refinery", icon: FlameKindling },
      { to: "/refinery", label: "Refinery Operations", icon: FlameKindling },
    ],
  },
  {
    id: "gold-inventory",
    label: "Gold & Inventory",
    icon: Package,
    items: [
      { to: "/ledger", label: "Gold Ledger", icon: BookOpen },
      { to: "/stock", label: "Ready Stock", icon: Package },
      { to: "/conversion", label: "Metal Conversion", icon: Scale },
      { to: "/barcode", label: "Barcode & Tagging", icon: ScanLine },
      { to: "/stock/boxes", label: "Box & Tray Masters", icon: Package },
      { to: "/stock/transfers", label: "Stock Transfers", icon: ArrowLeftRight },
      { to: "/stock/stones", label: "Stones & Diamonds", icon: Gem },
      { to: "/stock/verification", label: "Physical Stock Audit", icon: ScanLine },
      { to: "/catalog", label: "Catalog & Designs", icon: Gem },
    ],
  },
  {
    id: "billing",
    label: "Billing & Accounts",
    icon: Receipt,
    items: [
      { to: "/billing", label: "Sales & Invoices", icon: Receipt },
      { to: "/billing/purchases", label: "Purchases", icon: Receipt },
      { to: "/treasury/vouchers", label: "Receipts & Payments", icon: Landmark },
      { to: "/treasury/bank-reconciliation", label: "Bank Reconciliation", icon: Landmark },
      { to: "/expenses", label: "Expenses", icon: TrendingDown },
      { to: "/settlement/new", label: "Gold Settlement", icon: ArrowLeftRight },
      { to: "/control/accounts", label: "Chart of Accounts", icon: Landmark },
      { to: "/repair", label: "Repair Orders", icon: ShoppingBag },
      { to: "/attendance", label: "Attendance & Payroll", icon: Briefcase },
    ],
  },
  {
    id: "reports",
    label: "Reports & Documents",
    icon: BarChart3,
    items: [
      { to: "/reports", label: "Reports & Registers", icon: BarChart3 },
      { to: "/ledger", label: "Ledgers", icon: BookOpen },
      { to: "/control/tally-export", label: "Tally Export", icon: FileSpreadsheet },
      { to: "/dashboard/ceo", label: "CEO Dashboard", icon: Building2 },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    icon: SettingsIcon,
    items: [
      { to: "/control/customization", label: "Customization", icon: Sliders },
      { to: "/settings", label: "Users & Settings", icon: SettingsIcon, search: { tab: "users" } },
      { to: "/control/migration", label: "Data Import & Migration", icon: FileSpreadsheet },
      { to: "/branches", label: "Branches", icon: Building2 },
      { to: "/whatsapp", label: "WhatsApp Status", icon: MessageSquare },
      { to: "/communications", label: "Email & Comms", icon: Mail },
      { to: "/help", label: "Help & Guided Tours", icon: LifeBuoy },
    ],
  },
];

export function flattenNavigationGroups(groups: NavGroupDef[] = navigationGroups): NavItemDef[] {
  const seen = new Set<string>();
  const flat: NavItemDef[] = [];
  for (const group of groups) {
    for (const item of group.items) {
      const key = item.search ? `${item.to}?${JSON.stringify(item.search)}` : item.to;
      if (seen.has(key)) continue;
      seen.add(key);
      flat.push(item);
    }
  }
  return flat;
}

export function itemRouteKey(item: NavItemDef): string {
  return item.search ? `${item.to}?${JSON.stringify(item.search)}` : item.to;
}
