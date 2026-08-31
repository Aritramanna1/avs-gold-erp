/**
 * Mobile module directory — Offline ERP operational groups + AVS extras.
 * One entry per module; no duplicate create shortcuts.
 */
import type { LucideIcon } from "lucide-react";
import {
  Hammer,
  Package,
  Gem,
  Briefcase,
  FileText,
  ShoppingCart,
  Flame,
  Factory,
  Scale,
  BarChart3,
  BookOpen,
  Settings,
  HelpCircle,
  Users,
  Wallet,
  MessageCircle,
  Building2,
  FileSpreadsheet,
  RefreshCw,
  Wrench,
  Landmark,
  ScanLine,
  Bot,
  Receipt,
  Truck,
} from "lucide-react";

export interface MobileAction {
  id: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  to: string;
  search?: Record<string, string>;
  permissionPath?: string;
}

/** Production + barcode floor work (Offline Production / Barcode). */
export const MOBILE_WORK_ACTIONS: MobileAction[] = [
  { id: "orders", label: "Orders", icon: Briefcase, to: "/orders" },
  { id: "job-cards", label: "Job Cards (Dhadi)", icon: Wrench, to: "/manufacturing" },
  { id: "manufacturing", label: "Manufacturing Books", icon: Factory, to: "/workshop" },
  {
    id: "karigar",
    label: "Karigar Issue / Return",
    description: "Worker gold book",
    icon: Hammer,
    to: "/workshop/gold-book",
    permissionPath: "/workshop/gold-book",
  },
  { id: "outside", label: "Outside / Jangad", icon: Truck, to: "/workshop/outside-work" },
  { id: "barcode", label: "Barcode & Tagging", icon: ScanLine, to: "/barcode" },
  { id: "ready-stock", label: "Ready Stock", icon: Package, to: "/stock" },
  { id: "conversion", label: "Metal Conversion", icon: Scale, to: "/conversion" },
  { id: "melt", label: "Melt & Refinery", icon: Flame, to: "/melt" },
];

/** Offline Transaction + Master parties / billing. */
export const MOBILE_BUSINESS_ACTIONS: MobileAction[] = [
  {
    id: "parties",
    label: "Parties (Master)",
    description: "Customers, suppliers, karigars",
    icon: Users,
    to: "/people",
  },
  { id: "invoice", label: "Sale / Invoice", icon: Receipt, to: "/billing" },
  { id: "purchase", label: "Purchase", icon: ShoppingCart, to: "/billing/purchases" },
  { id: "estimate", label: "Estimate", icon: FileText, to: "/billing/estimates" },
  { id: "urd", label: "URD Purchase", icon: Scale, to: "/utilities/urd-purchase" },
  { id: "treasury", label: "Payment / Receipt", icon: Landmark, to: "/treasury/vouchers" },
  { id: "expense", label: "Expenses", icon: Wallet, to: "/expenses" },
  { id: "settlement", label: "Settlement", icon: Scale, to: "/settlement/new" },
  { id: "design", label: "Catalog & Designs", icon: Gem, to: "/catalog" },
];

export const MOBILE_REPORTS_ACTIONS: MobileAction[] = [
  { id: "reports", label: "Reports", icon: BarChart3, to: "/reports" },
  { id: "fine-rojmel", label: "Fine Rojmel", icon: BookOpen, to: "/reports/fine-rojmel" },
  { id: "cash-book", label: "Cash Book", icon: Wallet, to: "/treasury/cash-book" },
  { id: "ledgers", label: "Gold Ledger", icon: BookOpen, to: "/ledger" },
  { id: "ceo", label: "CEO Dashboard", icon: Building2, to: "/dashboard/ceo" },
  { id: "tally", label: "Tally Export", icon: FileSpreadsheet, to: "/control/tally-export" },
];

export const MOBILE_MORE_ACTIONS: MobileAction[] = [
  { id: "utilities", label: "Utilities Hub", icon: Wrench, to: "/utilities" },
  { id: "settings", label: "Settings", icon: Settings, to: "/settings" },
  { id: "customization", label: "Customization", icon: Settings, to: "/control/customization" },
  { id: "assistant", label: "AI Assistant", icon: Bot, to: "/assistant" },
  { id: "help", label: "Help & Support", icon: HelpCircle, to: "/help" },
  { id: "sync", label: "Sync Status", icon: RefreshCw, to: "/mobile/sync" },
  {
    id: "communications",
    label: "CRM & Communications",
    icon: MessageCircle,
    to: "/communications",
  },
  { id: "branches", label: "Branches", icon: Building2, to: "/branches" },
  { id: "attendance", label: "Attendance & Payroll", icon: Briefcase, to: "/attendance" },
];

/** @deprecated Use MOBILE_WORK_ACTIONS */
export const MOBILE_MASTER_ACTIONS: MobileAction[] = MOBILE_WORK_ACTIONS;

/** @deprecated Use MOBILE_TRANSACTION_ACTIONS */
export const MOBILE_TRANSACTION_ACTIONS: MobileAction[] = MOBILE_BUSINESS_ACTIONS;

export const MOBILE_QUICK_CREATE_ACTIONS: MobileAction[] = [];
export const MOBILE_QUICK_ACTIONS: MobileAction[] = [];

export const MOBILE_ASSISTANT_ACTIONS: MobileAction[] = [
  { id: "karigar", label: "Karigar Issue / Return", icon: Hammer, to: "/workshop/gold-book" },
  { id: "orders", label: "Orders", icon: Briefcase, to: "/orders" },
  { id: "billing", label: "Sale / Invoice", icon: FileText, to: "/billing" },
];
