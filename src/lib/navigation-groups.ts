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
    id: "crm",
    label: "CRM & Showroom",
    i18nKey: "group_crm",
    subtitleKey: "subtitle_crm",
    icon: Users,
    items: [
      { to: "/crm/360/cust-1", label: "Customer 360", i18nKey: "item_customer_360", icon: User },
      { to: "/crm/leads", label: "Leads & Enquiries", i18nKey: "item_leads", icon: MessageSquare },
      { to: "/crm/appointments", label: "Appointments Desk", i18nKey: "item_appointments", icon: Briefcase },
      { to: "/people", label: "Customer Directory", i18nKey: "item_account_master", icon: Users },
      { to: "/stock/boxes", label: "Showroom Box & Tray", i18nKey: "item_boxes", icon: Package },
      { to: "/communications", label: "Marketing Campaigns", i18nKey: "item_marketing", icon: Mail },
    ],
  },
  {
    id: "master",
    label: "Master",
    i18nKey: "group_master",
    subtitleKey: "subtitle_master",
    icon: Layers,
    items: [
      {
        id: "master-accounts",
        label: "Account",
        i18nKey: "folder_accounts",
        icon: Users,
        children: [
          {
            to: "/people",
            label: "Account Master",
            i18nKey: "item_account_master",
            icon: Users,
          },
        ],
      },
      {
        id: "master-ac-group",
        label: "Account Group",
        i18nKey: "folder_ac_group",
        icon: Landmark,
        children: [
          { to: "/control/accounts", label: "Account Group", i18nKey: "item_coa", icon: Landmark },
        ],
      },
      {
        id: "master-stones",
        label: "Dia/Stone Setup",
        i18nKey: "folder_stones",
        icon: Gem,
        children: [
          { to: "/stock/stones", label: "Stones & Diamonds", i18nKey: "item_stones", icon: Gem },
        ],
      },
      {
        id: "master-opening",
        label: "Opening Stock",
        i18nKey: "folder_opening_stock",
        icon: Package,
        separatorBefore: true,
        children: [
          {
            to: "/stock/entry",
            label: "Item Opening Stock",
            i18nKey: "item_stock_entry",
            icon: Package,
          },
          {
            to: "/utilities/opening-fine-cash",
            label: "Cash Fine Opening",
            i18nKey: "item_opening_fine_cash",
            icon: Wallet,
          },
        ],
      },
      {
        id: "master-company",
        label: "Company Detail",
        i18nKey: "folder_company",
        icon: Building2,
        children: [
          {
            to: "/settings",
            label: "Firm Master",
            i18nKey: "item_firm_master",
            icon: Building2,
            search: { tab: "firm" },
          },
          {
            to: "/utilities/counter-settings",
            label: "Counter Number",
            i18nKey: "item_counter",
            icon: FileText,
          },
          { to: "/control/rates", label: "Rate Master", i18nKey: "item_rate_master", icon: Scale },
        ],
      },
      {
        id: "master-users",
        label: "User Passwords",
        i18nKey: "folder_users",
        icon: SettingsIcon,
        children: [
          {
            to: "/settings",
            label: "User Master",
            i18nKey: "item_users_settings",
            icon: SettingsIcon,
            search: { tab: "users" },
          },
        ],
      },
    ],
  },
  {
    id: "transaction",
    label: "Transaction",
    i18nKey: "group_transaction",
    subtitleKey: "subtitle_transaction",
    icon: BookOpen,
    items: [
      { to: "/billing", label: "Sale", i18nKey: "item_sales", icon: Receipt },
      { to: "/billing/purchases", label: "Purchase", i18nKey: "item_purchases", icon: Receipt },
      {
        id: "txn-cash",
        label: "Payment / Receipt",
        i18nKey: "folder_pay_rec",
        icon: Wallet,
        separatorBefore: true,
        children: [
          {
            to: "/treasury/vouchers",
            label: "Cash Payment / Nave",
            i18nKey: "item_payment_nave",
            icon: Landmark,
            search: { tab: "payment" },
          },
          {
            to: "/treasury/vouchers",
            label: "Cash Receipt / Jama",
            i18nKey: "item_receipt_jama",
            icon: Wallet,
            search: { tab: "receipt" },
          },
          {
            to: "/treasury/vouchers",
            label: "Transfer / Contra",
            i18nKey: "item_transfer_contra",
            icon: ArrowLeftRight,
            search: { tab: "contra" },
          },
        ],
      },
      {
        to: "/settlement/new",
        label: "Settlement",
        i18nKey: "item_gold_settlement",
        icon: ArrowLeftRight,
      },
      {
        to: "/utilities/cash-fine-transfer",
        label: "Cash ↔ Fine Transfer",
        i18nKey: "item_cash_fine",
        icon: ArrowLeftRight,
      },
      {
        id: "txn-karigar",
        label: "Karigar Issue / Return",
        i18nKey: "folder_karigar_txn",
        icon: Hammer,
        separatorBefore: true,
        children: [
          {
            to: "/workshop/gold-book",
            label: "Karigar Issue / Return",
            i18nKey: "item_gold_book",
            icon: Hammer,
          },
          {
            to: "/workshop/karigar-book",
            label: "Karigar Book",
            i18nKey: "item_karigar_book",
            icon: BookOpen,
          },
        ],
      },
      {
        to: "/reports/fine-margin",
        label: "Fine Margin",
        i18nKey: "item_fine_margin",
        icon: BarChart3,
        search: { view: "profit" },
      },
      {
        to: "/reports/fine-margin",
        label: "Sale Fine",
        i18nKey: "item_sale_fine",
        icon: BarChart3,
        search: { view: "sale-fine" },
      },
      {
        to: "/reports/deleted-bills",
        label: "Delete Sale / Purchase Bills",
        i18nKey: "item_deleted_bills",
        icon: FileText,
      },
      { to: "/expenses", label: "Expenses", i18nKey: "item_expenses", icon: TrendingDown },
    ],
  },
  {
    id: "payroll",
    label: "Payroll",
    i18nKey: "group_payroll",
    subtitleKey: "subtitle_payroll",
    icon: Briefcase,
    items: [
      {
        id: "payroll-masters",
        label: "Employee Masters",
        i18nKey: "folder_payroll_masters",
        icon: Briefcase,
        children: [
          {
            to: "/people",
            label: "Employee Master",
            i18nKey: "item_employees",
            icon: Briefcase,
            search: { tab: "employees" },
          },
          {
            to: "/people",
            label: "Salary Group",
            i18nKey: "item_salary_group",
            icon: Users,
            search: { tab: "employees", panel: "groups" },
          },
          {
            to: "/people",
            label: "Department Master",
            i18nKey: "item_department_master",
            icon: Building2,
            search: { tab: "employees", panel: "departments" },
          },
        ],
      },
      {
        id: "payroll-pay",
        label: "Pay & Salary",
        i18nKey: "folder_payroll_pay",
        icon: Wallet,
        children: [
          {
            to: "/attendance",
            label: "Attendance",
            i18nKey: "item_attendance_only",
            icon: Briefcase,
            search: { tab: "daily" },
          },
          {
            to: "/attendance",
            label: "Emp. Payment",
            i18nKey: "item_emp_payment",
            icon: Landmark,
            search: { tab: "withdrawals" },
          },
          {
            to: "/attendance",
            label: "Emp. Receipt",
            i18nKey: "item_emp_receipt",
            icon: Wallet,
            search: { tab: "advances" },
          },
          {
            to: "/attendance",
            label: "Emp. Salary",
            i18nKey: "item_emp_salary",
            icon: FileCheck2,
            search: { tab: "settlement" },
          },
        ],
      },
    ],
  },
  {
    id: "barcode",
    label: "Barcode",
    i18nKey: "group_barcode",
    subtitleKey: "subtitle_barcode",
    icon: ScanLine,
    items: [
      { to: "/barcode", label: "Barcode", i18nKey: "item_barcode", icon: ScanLine },
      {
        to: "/workshop/barcode-scanner",
        label: "Search / Scan Barcode",
        i18nKey: "item_barcode_scan",
        icon: ScanLine,
      },
      {
        id: "barcode-stock",
        label: "Barcode Stock",
        i18nKey: "folder_barcode_stock",
        icon: Package,
        children: [
          {
            to: "/stock",
            label: "Item Stock / Ready Stock",
            i18nKey: "item_ready_stock",
            icon: Package,
          },
          { to: "/stock/lots", label: "Lot Wise / Tag Stock", i18nKey: "item_lots", icon: Package },
          {
            to: "/utilities/patla-stock",
            label: "Patla Stock",
            i18nKey: "item_patla",
            icon: Package,
          },
          {
            to: "/reports/barcode-stock",
            label: "Barcode Stock",
            i18nKey: "item_barcode_stock_rpt",
            icon: ScanLine,
            search: { view: "all" },
          },
          {
            to: "/reports/barcode-stock",
            label: "Single Barcode Stock",
            i18nKey: "item_barcode_stock_single",
            icon: ScanLine,
            search: { view: "single" },
          },
          {
            to: "/reports/barcode-stock",
            label: "Barcode Stock 2",
            i18nKey: "item_barcode_stock_2",
            icon: ScanLine,
            search: { view: "pending" },
          },
          {
            to: "/reports/barcode-stock",
            label: "Barcode Print / Scan",
            i18nKey: "item_barcode_print_scan",
            icon: Printer,
            search: { view: "print-scan" },
          },
          {
            to: "/barcode",
            label: "Import Barcode",
            i18nKey: "item_barcode_import",
            icon: ScanLine,
          },
          {
            to: "/stock/verification",
            label: "Stock Check",
            i18nKey: "item_stock_audit",
            icon: ScanLine,
          },
        ],
      },
      { to: "/hardware", label: "Weight Scan / Hardware", i18nKey: "item_hardware", icon: Cpu },
    ],
  },
  {
    id: "utility",
    label: "Utility",
    i18nKey: "group_utility",
    subtitleKey: "subtitle_utility",
    icon: Sliders,
    items: [
      { to: "/control/rates", label: "Daily Bhav / Rate Master", i18nKey: "item_rate_master", icon: Scale },
      {
        id: "utility-cheque",
        label: "Cheque",
        i18nKey: "folder_cheque",
        icon: Receipt,
        children: [
          {
            to: "/reports/bank-transactions",
            label: "Print",
            i18nKey: "item_cheque_print",
            icon: Printer,
          },
          {
            to: "/treasury/cash-book",
            label: "Checkbook",
            i18nKey: "item_cheque_checkbook",
            icon: Wallet,
          },
        ],
      },
      { to: "/reports/reminders", label: "Reminders", i18nKey: "item_reminders", icon: Bell },
      { to: "/utilities", label: "Utilities Hub", i18nKey: "item_utilities", icon: Sliders },
      {
        to: "/utilities/gst-calculator",
        label: "GST Calculator",
        i18nKey: "item_gst_calc",
        icon: Calculator,
      },
      {
        to: "/control/migration",
        label: "Transfer Data",
        i18nKey: "item_migration",
        icon: FileSpreadsheet,
      },
      {
        to: "/utilities/wipeout",
        label: "Period Close / Wipeout",
        i18nKey: "item_wipeout",
        icon: ShieldCheck,
      },
      {
        to: "/settings/backup-recovery",
        label: "Backup & Recovery",
        i18nKey: "item_backup",
        icon: ShieldCheck,
      },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    i18nKey: "group_reports_only",
    subtitleKey: "subtitle_reports",
    icon: BarChart3,
    items: [
      { to: "/reports", label: "Reports Hub", i18nKey: "item_reports", icon: BarChart3 },
      {
        id: "rpt-daily",
        label: "Daily Books",
        i18nKey: "folder_daily_books",
        icon: BookOpen,
        children: [
          {
            to: "/reports/daily-summary",
            label: "Daily Summary",
            i18nKey: "item_daily_summary",
            icon: FileText,
          },
          { to: "/reports/day-wise", label: "Day Wise", i18nKey: "item_day_wise", icon: FileText },
          {
            to: "/reports/fine-rojmel",
            label: "Fine Rojmel",
            i18nKey: "item_fine_rojmel",
            icon: BookOpen,
          },
          {
            to: "/reports/dar-rojmel",
            label: "Dar Rojmel",
            i18nKey: "item_dar_rojmel",
            icon: BookOpen,
          },
          { to: "/treasury/cash-book", label: "Cash Book", i18nKey: "item_cash_book", icon: Wallet },
        ],
      },
      {
        id: "rpt-accounts",
        label: "Account Reports",
        i18nKey: "folder_account_reports",
        icon: Landmark,
        children: [
          {
            to: "/reports/ledgers",
            label: "Accountwise Summary",
            i18nKey: "item_accountwise_summary",
            icon: BookOpen,
            search: { panel: "summary" },
          },
          {
            to: "/reports/ledgers",
            label: "Accountwise Details",
            i18nKey: "item_accountwise_details",
            icon: BookOpen,
            search: { panel: "details" },
          },
          {
            to: "/reports/account-balance",
            label: "Account Balance",
            i18nKey: "item_account_balance",
            icon: Landmark,
            search: { variant: "1" },
          },
          {
            to: "/reports/account-balance",
            label: "Account Balance 2",
            i18nKey: "item_account_balance_2",
            icon: Landmark,
            search: { variant: "2" },
          },
          {
            to: "/treasury/vouchers",
            label: "Payment / Receipt Register",
            i18nKey: "item_pay_rec_register",
            icon: Wallet,
          },
          {
            to: "/reports/bank-transactions",
            label: "Bank Transactions",
            i18nKey: "item_bank_transactions",
            icon: Landmark,
          },
        ],
      },
      {
        id: "rpt-stock",
        label: "Stock Reports",
        i18nKey: "folder_stock_reports",
        icon: Package,
        children: [
          {
            to: "/reports/item-jama-nave",
            label: "Itemwise Jama Nave",
            i18nKey: "item_item_jama_nave",
            icon: Package,
          },
          {
            to: "/reports/stock-valuation",
            label: "Item Stock",
            i18nKey: "item_item_stock_rpt",
            icon: Package,
          },
          {
            to: "/reports/barcode-stock",
            label: "Barcode Stock / Pending",
            i18nKey: "item_barcode_stock_rpt",
            icon: ScanLine,
          },
          {
            to: "/reports/city-wise",
            label: "Item Jama Nave City Wise",
            i18nKey: "item_city_wise",
            icon: Building2,
          },
        ],
      },
      {
        to: "/reports/item-jama-nave",
        label: "Account Wise Sale Purchase",
        i18nKey: "item_acc_wise_sale_purchase",
        icon: Receipt,
        search: { mode: "account" },
      },
      { to: "/reports/dhadi-book", label: "Dhadi Book", i18nKey: "item_dhadi_book", icon: Hammer },
      {
        to: "/reports/sales-register",
        label: "Retail Sale Report",
        i18nKey: "item_retail_sale_rpt",
        icon: FileSpreadsheet,
      },
      {
        to: "/reports/gst-returns",
        label: "GST Returns",
        i18nKey: "item_gst_returns",
        icon: FileSpreadsheet,
      },
      {
        to: "/reports/tanch-hishob",
        label: "Tanch / Hisob",
        i18nKey: "item_tanch_hishob",
        icon: Calculator,
      },
      {
        to: "/reports/bullion-ledger",
        label: "Bullion Ledger",
        i18nKey: "item_bullion_ledger",
        icon: Scale,
      },
      { to: "/reports/scheme", label: "Scheme Report", i18nKey: "item_scheme_report", icon: Layers },
      {
        to: "/reports/fine-margin",
        label: "Fine Margin",
        i18nKey: "item_fine_margin",
        icon: BarChart3,
        search: { view: "profit" },
      },
      {
        to: "/reports/fine-margin",
        label: "Sale Fine",
        i18nKey: "item_sale_fine",
        icon: BarChart3,
        search: { view: "sale-fine" },
      },
      {
        to: "/reports/total-profit",
        label: "Total Profit Earned (P&L)",
        i18nKey: "item_total_profit",
        icon: BarChart3,
      },
      {
        to: "/reports/owner-drawings",
        label: "Owner Drawings & Personal",
        i18nKey: "item_owner_drawings",
        icon: Wallet,
      },
      {
        to: "/reports/reconciliation-center",
        label: "Reconciliation Center",
        i18nKey: "item_reconciliation_center",
        icon: ShieldCheck,
      },
    ],
  },
  {
    id: "production",
    label: "Production",
    i18nKey: "group_production",
    subtitleKey: "subtitle_production",
    icon: Wrench,
    items: [
      {
        to: "/manufacturing/karigar-transactions",
        label: "Karigar Transaction Hub",
        i18nKey: "item_karigar_hub",
        icon: Hammer,
      },
      {
        id: "prod-dhadi",
        label: "Dhadi / Job Cards",
        i18nKey: "folder_dhadi",
        icon: Wrench,
        children: [
          {
            to: "/manufacturing",
            label: "Dhadi List / Job Cards",
            i18nKey: "item_job_cards",
            icon: Wrench,
          },
          {
            to: "/workshop/gold-book",
            label: "Dhadi Issue / Return",
            i18nKey: "item_gold_book",
            icon: Hammer,
          },
          {
            to: "/workshop/karigar-book",
            label: "Karigar Book",
            i18nKey: "item_karigar_book",
            icon: BookOpen,
          },
        ],
      },
      {
        to: "/workshop",
        label: "Manufacturing Books",
        i18nKey: "item_mfg_books",
        icon: BookOpen,
      },
      { to: "/workshop/vibrator", label: "Vibrator Out", i18nKey: "item_vibrator", icon: Wrench },
      { to: "/orders", label: "Orders", i18nKey: "item_orders", icon: ShoppingBag },
      { to: "/repair", label: "Repair Orders", i18nKey: "item_repair_orders", icon: ShoppingBag },
      {
        to: "/stock/hallmark",
        label: "QC / Hallmark",
        i18nKey: "item_qc_hallmark",
        icon: BadgeCheck,
      },
      { to: "/melt", label: "Melt & Refinery", i18nKey: "item_melt", icon: FlameKindling },
      { to: "/refinery", label: "Refinery Operations", i18nKey: "item_refinery", icon: FlameKindling },
      { to: "/conversion", label: "Melting Process", i18nKey: "item_melting_process", icon: Scale },
    ],
  },
  {
    id: "gst-estimate",
    label: "GST / Estimate",
    i18nKey: "group_gst_estimate",
    subtitleKey: "subtitle_gst_estimate",
    icon: FileSpreadsheet,
    items: [
      { to: "/billing", label: "Retail Sale GST / EST", i18nKey: "item_retail_sale", icon: Receipt },
      {
        to: "/billing/purchases",
        label: "Retail Purchase",
        i18nKey: "item_retail_purchase",
        icon: Receipt,
      },
      { to: "/billing/estimates", label: "Estimate", i18nKey: "item_estimates", icon: FileText },
      {
        to: "/billing/delivery-challans",
        label: "Delivery Challan",
        i18nKey: "item_dc",
        icon: FileText,
      },
      { to: "/utilities/urd-purchase", label: "URD Purchase", i18nKey: "item_urd", icon: Scale },
      {
        to: "/billing/credit-notes",
        label: "Credit Note",
        i18nKey: "item_credit_note",
        icon: FileText,
      },
      { to: "/billing/debit-notes", label: "Debit Note", i18nKey: "item_debit_note", icon: FileText },
    ],
  },
  {
    id: "scheme",
    label: "Scheme",
    i18nKey: "group_scheme",
    subtitleKey: "subtitle_scheme",
    icon: Layers,
    items: [
      { to: "/scheme/plans", label: "Scheme Master", i18nKey: "item_scheme_plans", icon: FileText },
      {
        to: "/scheme/accounts",
        label: "Scheme Account",
        i18nKey: "item_scheme_accounts",
        icon: Users,
      },
      {
        to: "/scheme/receipts",
        label: "Scheme Receipt",
        i18nKey: "item_scheme_receipts",
        icon: Receipt,
      },
      { to: "/reports/scheme", label: "Scheme Report", i18nKey: "item_scheme_report", icon: BarChart3 },
      { to: "/scheme", label: "Scheme Hub", i18nKey: "item_scheme_hub", icon: Layers },
    ],
  },
  {
    id: "avs-platform",
    label: "AVS Platform",
    i18nKey: "group_avs_platform",
    subtitleKey: "subtitle_avs_platform",
    icon: Bot,
    items: [
      {
        to: "/control/customization",
        label: "Customization",
        i18nKey: "item_customization",
        icon: Sliders,
      },
      {
        to: "/communications",
        label: "CRM & Communications",
        i18nKey: "item_crm",
        icon: MessageSquare,
      },
      { to: "/whatsapp", label: "WhatsApp Status", i18nKey: "item_whatsapp", icon: MessageSquare },
      { to: "/communications", label: "Email & Comms", i18nKey: "item_email_comms", icon: Mail },
      { to: "/ai-center", label: "AI Center (Disabled)", i18nKey: "item_ai_center", icon: Cpu },
      { to: "/settings/automation", label: "Automation Center", i18nKey: "item_automation", icon: Sliders },
      { to: "/notifications", label: "Notifications", i18nKey: "item_notifications", icon: Bell },
      { to: "/branches", label: "Branches", i18nKey: "item_branches", icon: Building2 },
      { to: "/dashboard/ceo", label: "Founder Cockpit", i18nKey: "item_ceo", icon: Building2 },
      { to: "/reports/erp-audit", label: "ERP Audit", i18nKey: "item_erp_audit", icon: ShieldCheck },
      {
        to: "/control/tally-export",
        label: "Tally Export",
        i18nKey: "item_tally",
        icon: FileSpreadsheet,
      },
      { to: "/help", label: "Help & Guided Tours", i18nKey: "item_help", icon: LifeBuoy },
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
