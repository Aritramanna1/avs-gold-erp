/**
 * Action-first mobile catalog — progressive: Category → Action → Form route.
 */
import type { LucideIcon } from "lucide-react";
import {
  UserPlus,
  Truck,
  Hammer,
  Package,
  Gem,
  Briefcase,
  FileText,
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Receipt,
  ShoppingCart,
  Flame,
  Factory,
} from "lucide-react";

export interface MobileAction {
  id: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  to: string;
  search?: Record<string, string>;
}

export const MOBILE_MASTER_ACTIONS: MobileAction[] = [
  { id: "customer", label: "Create Customer", icon: UserPlus, to: "/people", search: { new: "1" } },
  {
    id: "supplier",
    label: "Create Supplier",
    icon: Truck,
    to: "/people",
    search: { new: "1", type: "supplier" },
  },
  {
    id: "karigar",
    label: "Create Karigar",
    icon: Hammer,
    to: "/people",
    search: { new: "1", type: "karigar" },
  },
  { id: "item", label: "Create Item / Stock", icon: Package, to: "/stock/entry" },
  { id: "design", label: "Create Design", icon: Gem, to: "/catalog", search: { new: "1" } },
  { id: "job", label: "Create Job", icon: Briefcase, to: "/orders/new" },
];

export const MOBILE_TRANSACTION_ACTIONS: MobileAction[] = [
  { id: "invoice", label: "Create Invoice", icon: FileText, to: "/billing", search: { new: "1" } },
  {
    id: "issue-gold",
    label: "Issue Gold",
    icon: ArrowUpRight,
    to: "/workshop",
    search: { action: "issue" },
  },
  {
    id: "receive-gold",
    label: "Receive Gold",
    icon: ArrowDownLeft,
    to: "/workshop",
    search: { action: "receive" },
  },
  {
    id: "payment",
    label: "Create Payment",
    icon: CreditCard,
    to: "/treasury/vouchers",
    search: { tab: "payment" },
  },
  {
    id: "receipt",
    label: "Create Receipt",
    icon: Receipt,
    to: "/treasury/vouchers",
    search: { tab: "receipt" },
  },
  { id: "purchase", label: "Purchase", icon: ShoppingCart, to: "/billing/purchases" },
  { id: "melt", label: "Metal Conversion", icon: Flame, to: "/melt" },
  { id: "manufacturing", label: "Manufacturing", icon: Factory, to: "/workshop" },
];

export const MOBILE_QUICK_ACTIONS: MobileAction[] = [
  {
    id: "gold-position",
    label: "Fine Gold Position",
    icon: Coins,
    to: "/assistant",
    search: { q: "fine gold position today" },
  },
  {
    id: "issue-return",
    label: "Issue / Return Today",
    icon: ArrowUpRight,
    to: "/assistant",
    search: { q: "show today issued and returned" },
  },
  { id: "stock-mobile", label: "Stock Entry", icon: Package, to: "/stock/entry" },
  { id: "orders", label: "Open Orders", icon: Briefcase, to: "/orders" },
];

export const MOBILE_ASSISTANT_ACTIONS: MobileAction[] = [
  {
    id: "create-invoice",
    label: "Create Invoice",
    icon: FileText,
    to: "/billing",
    search: { new: "1" },
  },
  {
    id: "issue-material",
    label: "Issue Material",
    icon: ArrowUpRight,
    to: "/workshop",
    search: { action: "issue" },
  },
  {
    id: "receive-material",
    label: "Receive Material",
    icon: ArrowDownLeft,
    to: "/workshop",
    search: { action: "receive" },
  },
  {
    id: "create-customer",
    label: "Create Customer",
    icon: UserPlus,
    to: "/people",
    search: { new: "1" },
  },
  {
    id: "create-karigar",
    label: "Create Karigar",
    icon: Hammer,
    to: "/people",
    search: { new: "1", type: "karigar" },
  },
  { id: "all-actions", label: "View All Actions", icon: Briefcase, to: "/master" },
];
