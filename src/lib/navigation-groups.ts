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
  Wallet,
  ShieldCheck,
  Bot,
  Cpu,
  Bell,
  Calculator,
  FileText,
  Layers,
  Printer,
  List,
  FileCheck2,
} from "lucide-react";

/**
 * Navigation node — leaf opens a route; folder opens a nested cascade menu
 * (Offline / Jwelly Ace style: click → submenu → click leaf → form).
 */
export type NavItemDef = {
  /** Stable id for folders (optional for leaves). */
  id?: string;
  /** Leaf route — required when there are no children. */
  to?: string;
  label: string;
  /** Key under `navigation.*` for en/hi/mr/bn. */
  i18nKey: string;
  icon: LucideIcon;
  search?: Record<string, string>;
  /** Nested cascade submenu (click path only — does not open a page). */
  children?: NavItemDef[];
  /** Draw a separator line above this entry in the cascade menu. */
  separatorBefore?: boolean;
};

export type NavGroupDef = {
  id: string;
  label: string;
  i18nKey: string;
  /** Optional subtitle under group header (i18n key). */
  subtitleKey?: string;
  icon: LucideIcon;
  items: NavItemDef[];
};

export function isNavFolder(item: NavItemDef): boolean {
  return Array.isArray(item.children) && item.children.length > 0;
}

export function isNavLeaf(item: NavItemDef): item is NavItemDef & { to: string } {
  return !!item.to && !isNavFolder(item);
}

/** Depth-first leaf routes only (for permissions, route verify, command palette). */
export function collectNavLeaves(items: NavItemDef[]): NavItemDef[] {
  const out: NavItemDef[] = [];
  for (const item of items) {
    if (isNavFolder(item)) {
      out.push(...collectNavLeaves(item.children!));
    } else if (item.to) {
      out.push(item);
    }
  }
  return out;
}

export function itemRouteKey(item: NavItemDef): string {
  if (isNavFolder(item)) return `folder:${item.id ?? item.i18nKey}`;
  return item.search ? `${item.to}?${JSON.stringify(item.search)}` : (item.to ?? item.i18nKey);
}

function filterNavTree(
  items: NavItemDef[],
  allow: (to: string) => boolean,
): NavItemDef[] {
  const out: NavItemDef[] = [];
  for (const item of items) {
    if (isNavFolder(item)) {
      const kids = filterNavTree(item.children!, allow);
      if (kids.length === 0) continue;
      out.push({ ...item, children: kids });
      continue;
    }
    if (item.to && allow(item.to)) out.push(item);
  }
  return out;
}

import { useInstallationConfig } from "@/lib/installation-config";
import { useBusinessRules } from "@/lib/business-rules-store";
import { useCustomizationHubPreferences } from "@/lib/customization-hub-preferences-store";

function isNavRouteAllowed(to: string): boolean {
  try {
    const portals = useInstallationConfig.getState().activePortals;
    if (to === "/karigar-portal" && portals && portals.karigar === false) return false;
    if (to === "/customer-portal" && portals && portals.customer === false) return false;
    if (to === "/supplier-portal" && portals && portals.supplier === false) return false;

    // Sub-accounts disabled in this edition profile
    if (to === "/utilities/sub-accounts") return false;

    const rules = useBusinessRules.getState();
    if (to.startsWith("/orders") && !rules.isEnabled("enable_orders_module")) return false;
    if (to === "/assistant" && !rules.isEnabled("enable_ai_assistant")) return false;

    // ── Customization Hub Features Filter ──
    const feat = useCustomizationHubPreferences.getState().features;

    // Always block duplicate owner transaction route (owner drawings belong to /expenses)
    if (to === "/manufacturing/owner-transactions") return false;

    // Schemes: Hide if explicitly disabled in features
    if (feat?.disableSchemeManagement && (to.startsWith("/scheme") || to === "/reports/scheme")) {
      return false;
    }

    // Box & Tray Master: Hide if explicitly disabled in features
    if (feat?.disableBoxTrayMaster && (to.includes("box") || to.includes("tray"))) {
      return false;
    }

    // DHADI Group: Hide if explicitly disabled
    if (feat?.disableDhadiGroup && to.includes("dhadi")) {
      return false;
    }

    // Diamond / Stone: Hide if explicitly disabled
    if (feat?.disableDiamondStoneFeature && (to.includes("diamond") || to.includes("stone"))) {
      return false;
    }
  } catch {
    /* fallback to allowed */
  }
  return true;
}

/** Keep folders that still have at least one permitted leaf and enforce top-level group permissions. */
export function filterNavGroupsByPermission(
  groups: NavGroupDef[],
  allow: (to: string) => boolean,
): NavGroupDef[] {
  return groups
    .map((group) => ({
      ...group,
      items: filterNavTree(group.items, (to) => allow(to) && isNavRouteAllowed(to)),
    }))
    .filter((group) => group.items.length > 0);
}

/**
 * Primary ERP navigation — Offline ERP menus (Master → … → Bullion) with
 * nested cascade folders matching classic jewellery ERP click paths
 * (e.g. Utility → Cheque → Print / Register / Checkbook).
 *
 * Source menus: AVS-ERP-Offline/analysis/menus_forms.txt
 * Cascade UX: Jwelly Ace / Offline WinForms menubar behaviour.
 */
export const navigationGroups: NavGroupDef[] = [
  {
    id: "home",
    label: "Home",
    i18nKey: "group_home",
    icon: Home,
    items: [
      { to: "/app", label: "Dashboard", i18nKey: "item_dashboard", icon: Home },
      { to: "/dashboard/ceo", label: "Founder Cockpit", i18nKey: "item_ceo", icon: Building2 },
    ],
  },
  {
    id: "retail",
    label: "Retail",
    i18nKey: "group_retail",
    icon: ShoppingBag,
    items: [
      { to: "/app", label: "Retail Dashboard", i18nKey: "item_dashboard", icon: Home },
      {
        id: "retail-customers",
        label: "Customers",
        i18nKey: "item_customers",
        icon: Users,
        children: [
          {
            to: "/people",
            label: "Customers Directory",
            i18nKey: "item_customers",
            icon: Users,
            search: { tab: "customers" },
          },
          { to: "/crm/leads", label: "CRM / Leads", i18nKey: "item_leads", icon: MessageSquare },
          { to: "/crm/appointments", label: "Appointments", i18nKey: "item_appointments", icon: Briefcase },
        ],
      },
      {
        id: "retail-catalogue-stock",
        label: "Catalogue & Stock",
        i18nKey: "item_catalog",
        icon: Gem,
        children: [
          { to: "/catalog", label: "Products / Catalogue", i18nKey: "item_catalog", icon: Gem },
          { to: "/stock", label: "Stock", i18nKey: "item_ready_stock", icon: Package },
          { to: "/stock", label: "Ready Stock", i18nKey: "item_ready_stock", icon: Package, search: { tab: "ready" } },
        ],
      },
      {
        id: "retail-sales",
        label: "Sales & Billing",
        i18nKey: "item_sales",
        icon: Receipt,
        children: [
          { to: "/billing", label: "Sales Billing", i18nKey: "item_sales", icon: Receipt },
          { to: "/billing/estimates", label: "Quotations & Estimates", i18nKey: "item_estimates", icon: FileText },
        ],
      },
      {
        id: "retail-payments",
        label: "Payments & Ledger",
        i18nKey: "item_receipt_jama",
        icon: Wallet,
        children: [
          {
            to: "/treasury/vouchers",
            label: "Payments & Receipts",
            i18nKey: "item_receipt_jama",
            icon: Wallet,
            search: { tab: "receipt" },
          },
          { to: "/reports/ledgers", label: "Customer Ledger", i18nKey: "item_ledgers", icon: BookOpen },
        ],
      },
      { to: "/reports/sales-register", label: "Retail Reports", i18nKey: "item_retail_sale_rpt", icon: BarChart3 },
    ],
  },
  {
    id: "manufacturing",
    label: "Manufacturing",
    i18nKey: "group_manufacturing",
    icon: Hammer,
    items: [
      { to: "/workshop", label: "Manufacturing Dashboard", i18nKey: "item_dashboard", icon: Wrench },
      {
        id: "mfg-stock",
        label: "Stock & Inventory",
        i18nKey: "item_ready_stock",
        icon: Package,
        children: [
          { to: "/stock/entry", label: "Opening Stock", i18nKey: "item_stock_entry", icon: Package },
          { to: "/utilities/item-transaction", label: "Item Transactions", i18nKey: "item_item_txn_entry", icon: ArrowLeftRight },
          { to: "/reports/item-jama-nave", label: "Manufacturing Stock", i18nKey: "item_item_jama_nave", icon: Package },
          { to: "/stock", label: "Stock", i18nKey: "item_ready_stock", icon: Package },
          { to: "/stock", label: "Ready Stock", i18nKey: "item_ready_stock", icon: Package, search: { tab: "ready" } },
        ],
      },
      {
        id: "mfg-karigar",
        label: "Karigar Workflows",
        i18nKey: "folder_karigar_txn",
        icon: Hammer,
        children: [
          { to: "/workshop/gold-book", label: "Karigar Issue / Return", i18nKey: "item_gold_book", icon: Hammer },
          { to: "/workshop/karigar-book", label: "Karigar Book", i18nKey: "item_karigar_book", icon: BookOpen },
          { to: "/workshop/bench-custody", label: "Bench Custody", i18nKey: "item_bench_custody", icon: ShieldCheck },
          { to: "/settlement/new", label: "Karigar Settlements", i18nKey: "item_gold_settlement", icon: Wallet },
        ],
      },
      { to: "/orders", label: "Production & Job Cards", i18nKey: "item_job_cards", icon: ShoppingBag },
      {
        id: "mfg-processes",
        label: "Processes & Workshop",
        i18nKey: "item_melting_process",
        icon: Scale,
        children: [
          { to: "/conversion", label: "Melting Process", i18nKey: "item_melting_process", icon: Scale },
          { to: "/melt", label: "Melt & Refinery", i18nKey: "item_melt", icon: FlameKindling },
          { to: "/refinery", label: "Refinery Operations", i18nKey: "item_refinery", icon: FlameKindling },
          { to: "/workshop/vibrator", label: "Vibrator Out", i18nKey: "item_vibrator", icon: Wrench },
          { to: "/workshop/outside-work", label: "Outside Work", i18nKey: "item_outside_work", icon: Truck },
        ],
      },
      {
        id: "mfg-quality",
        label: "Quality & Barcoding",
        i18nKey: "item_qc_hallmark",
        icon: BadgeCheck,
        children: [
          { to: "/stock/hallmark", label: "Hallmark & QC", i18nKey: "item_qc_hallmark", icon: BadgeCheck },
          { to: "/barcode", label: "Barcode Generation", i18nKey: "item_barcode", icon: ScanLine },
          { to: "/workshop/barcode-scanner", label: "Barcode Scanner", i18nKey: "item_barcode_scan", icon: ScanLine },
        ],
      },
      {
        id: "mfg-settlement",
        label: "Sales & Settlement",
        i18nKey: "item_sales",
        icon: Receipt,
        children: [
          { to: "/manufacturing", label: "Manufacturing Sales", i18nKey: "item_sales", icon: Receipt },
          { to: "/settlement/new", label: "Payments / Settlement", i18nKey: "item_gold_settlement", icon: Wallet },
        ],
      },
      { to: "/expenses", label: "Owner Transactions", i18nKey: "item_expenses", icon: TrendingDown },
      {
        id: "mfg-reports",
        label: "Manufacturing Reports",
        i18nKey: "item_reports",
        icon: BarChart3,
        children: [
          { to: "/reports", label: "Manufacturing Reports", i18nKey: "item_reports", icon: BarChart3, search: { category: "manufacturing" } },
          { to: "/reports/bullion-ledger", label: "Manufacturing Ledger", i18nKey: "item_bullion_ledger", icon: BookOpen },
        ],
      },
      {
        id: "mfg-setup",
        label: "Manufacturing Setup",
        i18nKey: "group_master",
        icon: Layers,
        separatorBefore: true,
        children: [
          { to: "/utilities/item-masters", label: "Item Masters", i18nKey: "item_item_masters", icon: Layers },
          { to: "/workshop/dhadi-groups", label: "Dhadi Group", i18nKey: "item_dhadi_groups", icon: Layers },
          { to: "/stock/stones", label: "Dia / Stone Setup", i18nKey: "item_stones", icon: Gem },
        ],
      },
    ],
  },
  {
    id: "accounts",
    label: "Accounts",
    i18nKey: "group_accounts",
    icon: Landmark,
    items: [
      { to: "/control/accounts", label: "Accounts Overview", i18nKey: "item_dashboard", icon: Landmark },
      {
        id: "acc-masters",
        label: "Chart of Accounts",
        i18nKey: "item_account_master",
        icon: Users,
        children: [
          { to: "/people", label: "Accounts Directory", i18nKey: "item_account_master", icon: Users },
          { to: "/control/accounts", label: "Account Groups", i18nKey: "item_coa", icon: Landmark },
        ],
      },
      {
        id: "acc-books",
        label: "Accounting Books",
        i18nKey: "folder_daily_books",
        icon: BookOpen,
        children: [
          { to: "/ledger", label: "General Ledger", i18nKey: "item_ledgers", icon: BookOpen },
          { to: "/reports/daily-summary", label: "Day Book", i18nKey: "item_daily_summary", icon: FileText },
          { to: "/treasury/cash-book", label: "Cash Book", i18nKey: "item_cash_book", icon: Wallet },
          { to: "/reports/bank-transactions", label: "Bank Book", i18nKey: "item_bank_transactions", icon: Landmark },
          { to: "/treasury/vouchers", label: "Vouchers", i18nKey: "item_payment_nave", icon: Receipt },
          {
            to: "/treasury/vouchers",
            label: "Contra Transfer",
            i18nKey: "item_transfer_contra",
            icon: ArrowLeftRight,
            search: { tab: "contra" },
          },
        ],
      },
      {
        id: "acc-statements",
        label: "Financial Statements",
        i18nKey: "item_financial_statements",
        icon: FileSpreadsheet,
        children: [
          { to: "/reports/account-balance", label: "Trial Balance", i18nKey: "item_account_balance", icon: Scale },
          { to: "/reports/total-profit", label: "Profit & Loss", i18nKey: "item_total_profit", icon: BarChart3 },
          { to: "/reports/financial-statements", label: "Balance Sheet / Statements", i18nKey: "item_financial_statements", icon: FileSpreadsheet },
        ],
      },
      {
        id: "acc-tax",
        label: "Tax & Purchases",
        i18nKey: "item_gst_returns",
        icon: FileSpreadsheet,
        children: [
          { to: "/reports/gst-returns", label: "GST Reports", i18nKey: "item_gst_returns", icon: FileSpreadsheet },
          { to: "/billing/purchases", label: "Purchase Register", i18nKey: "item_purchases", icon: Receipt },
        ],
      },
      { to: "/reports/reconciliation-center", label: "Reconciliation Center", i18nKey: "item_reconciliation_center", icon: ShieldCheck },
    ],
  },
  {
    id: "payroll",
    label: "Payroll",
    i18nKey: "group_payroll",
    icon: Briefcase,
    items: [
      {
        to: "/people",
        label: "Employees",
        i18nKey: "item_employees",
        icon: Users,
        search: { tab: "employees" },
      },
      {
        to: "/attendance",
        label: "Attendance",
        i18nKey: "item_attendance_only",
        icon: Briefcase,
        search: { tab: "daily" },
      },
      {
        to: "/people",
        label: "Salary Rules",
        i18nKey: "item_salary_group",
        icon: Sliders,
        search: { tab: "employees", panel: "groups" },
      },
      {
        to: "/attendance",
        label: "Advances",
        i18nKey: "item_emp_receipt",
        icon: Wallet,
        search: { tab: "advances" },
      },
      {
        to: "/attendance",
        label: "Settlements",
        i18nKey: "item_emp_salary",
        icon: FileCheck2,
        search: { tab: "settlement" },
      },
      {
        to: "/attendance",
        label: "Payroll Reports",
        i18nKey: "item_emp_payment",
        icon: BarChart3,
        search: { tab: "withdrawals" },
      },
    ],
  },
  {
    id: "documents",
    label: "Documents",
    i18nKey: "group_documents",
    icon: FileText,
    items: [
      { to: "/settings/document-vault", label: "Document Centre", i18nKey: "group_documents", icon: FileText },
      { to: "/verify", label: "Public Verification", i18nKey: "item_verify", icon: ShieldCheck },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    i18nKey: "group_reports_only",
    icon: BarChart3,
    items: [
      {
        id: "rpt-financial",
        label: "Financial Reports",
        i18nKey: "item_financial_statements",
        icon: FileSpreadsheet,
        children: [
          { to: "/reports/financial-statements", label: "Financial Statements", i18nKey: "item_financial_statements", icon: FileSpreadsheet },
          { to: "/reports/account-balance", label: "Trial Balance", i18nKey: "item_account_balance", icon: Scale },
          { to: "/reports/total-profit", label: "Profit & Loss", i18nKey: "item_total_profit", icon: BarChart3 },
        ],
      },
      {
        id: "rpt-gst",
        label: "GST & Tax Reports",
        i18nKey: "item_gst_returns",
        icon: FileSpreadsheet,
        children: [
          { to: "/reports/gst-returns", label: "GST Returns", i18nKey: "item_gst_returns", icon: FileSpreadsheet },
          { to: "/billing/purchases", label: "Purchase Register", i18nKey: "item_purchases", icon: Receipt },
        ],
      },
      {
        id: "rpt-retail",
        label: "Retail Reports",
        i18nKey: "item_retail_sale_rpt",
        icon: Receipt,
        children: [
          { to: "/reports/sales-register", label: "Sales Register", i18nKey: "item_retail_sale_rpt", icon: Receipt },
          { to: "/reports/ledgers", label: "Customer Ledgers", i18nKey: "item_ledgers", icon: BookOpen },
        ],
      },
      {
        id: "rpt-manufacturing",
        label: "Manufacturing Reports",
        i18nKey: "item_item_jama_nave",
        icon: Hammer,
        children: [
          { to: "/reports/item-jama-nave", label: "Manufacturing Stock", i18nKey: "item_item_jama_nave", icon: Hammer },
          { to: "/reports/barcode-stock", label: "Barcode Inventory", i18nKey: "item_barcode_stock_rpt", icon: Package },
          { to: "/reports/bullion-ledger", label: "Manufacturing Ledger", i18nKey: "item_bullion_ledger", icon: BookOpen },
        ],
      },
      {
        id: "rpt-karigar",
        label: "Karigar Reports",
        i18nKey: "item_dhadi_book",
        icon: BookOpen,
        children: [
          { to: "/reports/dhadi-book", label: "Dhadi Book", i18nKey: "item_dhadi_book", icon: BookOpen },
          { to: "/workshop/karigar-book", label: "Karigar Outstanding", i18nKey: "item_karigar_book", icon: BookOpen },
        ],
      },
      { to: "/attendance", label: "Payroll Reports", i18nKey: "item_emp_payment", icon: Briefcase, search: { tab: "withdrawals" } },
      { to: "/reports/owner-drawings", label: "Owner Reports", i18nKey: "item_owner_drawings", icon: Wallet },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    i18nKey: "group_settings",
    icon: SettingsIcon,
    items: [
      {
        id: "set-company",
        label: "Company & Branches",
        i18nKey: "item_firm_master",
        icon: Building2,
        children: [
          {
            to: "/settings",
            label: "Company Firm",
            i18nKey: "item_firm_master",
            icon: Building2,
            search: { tab: "firm" },
          },
          { to: "/branches", label: "Branches", i18nKey: "item_branches", icon: Building2 },
        ],
      },
      {
        to: "/settings",
        label: "Users & Roles",
        i18nKey: "item_users_settings",
        icon: Users,
        search: { tab: "users" },
      },
      {
        id: "set-config",
        label: "Business Configuration",
        i18nKey: "item_customization",
        icon: Sliders,
        children: [
          { to: "/control/customization", label: "Customization", i18nKey: "item_customization", icon: Sliders },
          { to: "/settings/workflow", label: "Workflow", i18nKey: "item_workflow", icon: Sliders },
          {
            to: "/control/customization",
            label: "Processes",
            i18nKey: "item_processes",
            icon: Wrench,
            search: { tab: "processes" },
          },
          { to: "/control/rates", label: "Rates", i18nKey: "item_rate_master", icon: Scale },
          {
            to: "/control/customization",
            label: "Charges",
            i18nKey: "item_charges",
            icon: Calculator,
            search: { tab: "charges" },
          },
        ],
      },
      {
        id: "set-integrations",
        label: "Integrations & Automation",
        i18nKey: "item_integrations",
        icon: Bot,
        children: [
          {
            to: "/settings",
            label: "Integrations",
            i18nKey: "item_integrations",
            icon: Sliders,
            search: { tab: "integrations" },
          },
          { to: "/settings/automation", label: "Automation", i18nKey: "item_automation", icon: Bot },
        ],
      },
      {
        id: "set-security",
        label: "Security & Health",
        i18nKey: "item_security",
        icon: ShieldCheck,
        children: [
          {
            to: "/settings",
            label: "Security",
            i18nKey: "item_security",
            icon: ShieldCheck,
            search: { tab: "security" },
          },
          { to: "/reports/erp-audit", label: "Audit", i18nKey: "item_erp_audit", icon: ShieldCheck },
          { to: "/settings/storage-diagnostics", label: "System Health", i18nKey: "item_system_health", icon: Cpu },
        ],
      },
    ],
  },
];

export function flattenNavigationGroups(groups: NavGroupDef[] = navigationGroups): NavItemDef[] {
  const seen = new Set<string>();
  const flat: NavItemDef[] = [];
  for (const group of groups) {
    for (const leaf of collectNavLeaves(group.items)) {
      const key = itemRouteKey(leaf);
      if (seen.has(key)) continue;
      seen.add(key);
      flat.push(leaf);
    }
  }
  return flat;
}

/** Resolve which Offline-style menu group owns the current path. */
export function findGroupForPath(
  pathname: string,
  search: Record<string, unknown> = {},
  groups: NavGroupDef[] = navigationGroups,
): NavGroupDef | undefined {
  const searchEntries = Object.entries(search).filter(([, v]) => v != null && v !== "");
  let best: { group: NavGroupDef; score: number } | undefined;

  for (const group of groups) {
    for (const item of collectNavLeaves(group.items)) {
      if (!item.to) continue;
      const pathMatch =
        item.to === "/"
          ? pathname === "/"
          : pathname === item.to || pathname.startsWith(`${item.to}/`);
      if (!pathMatch) continue;

      let score = item.to.length;
      if (item.search) {
        const ok = Object.entries(item.search).every(([k, v]) => String(search[k] ?? "") === v);
        if (!ok) {
          score = item.to.length;
        } else {
          score = item.to.length + 100 + Object.keys(item.search).length;
        }
      } else if (searchEntries.length > 0) {
        score = item.to.length;
      }

      if (!best || score > best.score) best = { group, score };
    }
  }
  return best?.group;
}

export type BreadcrumbTrailItem = {
  label: string;
  href?: string;
  isFolder?: boolean;
};

function findTrailInItems(
  items: NavItemDef[],
  pathname: string,
  search: Record<string, unknown>,
): BreadcrumbTrailItem[] | null {
  for (const item of items) {
    if (isNavFolder(item)) {
      const sub = findTrailInItems(item.children ?? [], pathname, search);
      if (sub) {
        return [{ label: item.label, isFolder: true }, ...sub];
      }
    } else if (item.to) {
      const matches =
        item.to === "/"
          ? pathname === "/"
          : pathname === item.to || pathname.startsWith(`${item.to}/`);
      if (matches) {
        if (item.search) {
          const ok = Object.entries(item.search).every(([k, v]) => String(search[k] ?? "") === v);
          if (ok) return [{ label: item.label, href: item.to }];
        } else {
          return [{ label: item.label, href: item.to }];
        }
      }
    }
  }
  return null;
}

export function resolveBreadcrumbTrail(
  pathname: string,
  search: Record<string, unknown> = {},
  groups: NavGroupDef[] = navigationGroups,
): BreadcrumbTrailItem[] {
  if (pathname === "/" || pathname === "/app") {
    return [{ label: "Home", href: "/app" }, { label: "Dashboard" }];
  }

  for (const group of groups) {
    const trail = findTrailInItems(group.items, pathname, search);
    if (trail) {
      return [{ label: group.label }, ...trail];
    }
  }

  const parts = pathname.split("/").filter(Boolean);
  return parts.map((p, idx) => ({
    label: p.charAt(0).toUpperCase() + p.slice(1).replace(/-/g, " "),
    href: idx < parts.length - 1 ? "/" + parts.slice(0, idx + 1).join("/") : undefined,
  }));
}

