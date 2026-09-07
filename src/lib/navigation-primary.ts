import type { NavItemDef } from "./navigation-groups";
import { collectNavLeaves, itemRouteKey, isNavFolder } from "./navigation-groups";

/**
 * Daily-use form i18n keys per Offline ERP menu — used when flattening cascade
 * trees for progressive disclosure (phone drawer / secondary lists).
 */
export const PRIMARY_NAV_I18N_BY_GROUP: Record<string, readonly string[]> = {
  home: ["item_dashboard", "item_ceo"],
  retail: [
    "item_dashboard",
    "item_customers",
    "item_leads",
    "item_catalog",
    "item_ready_stock",
    "item_sales",
    "item_estimates",
    "item_receipt_jama",
    "item_ledgers",
    "item_retail_sale_rpt",
  ],
  manufacturing: [
    "item_dashboard",
    "item_stock_entry",
    "item_item_txn_entry",
    "item_gold_book",
    "item_job_cards",
    "item_melting_process",
    "item_item_jama_nave",
    "item_ready_stock",
    "item_qc_hallmark",
    "item_barcode",
    "item_sales",
    "item_gold_settlement",
    "item_expenses",
    "item_bullion_ledger",
  ],
  accounts: [
    "item_account_master",
    "item_coa",
    "item_ledgers",
    "item_daily_summary",
    "item_cash_book",
    "item_account_balance",
    "item_total_profit",
    "item_financial_statements",
    "item_gst_returns",
    "item_purchases",
  ],
  payroll: [
    "item_employees",
    "item_attendance_only",
    "item_salary_group",
    "item_emp_receipt",
    "item_emp_salary",
    "item_emp_payment",
  ],
  portals: ["item_customers", "item_karigars", "item_suppliers"],
  documents: ["group_documents", "item_verify"],
  reports: [
    "item_financial_statements",
    "item_gst_returns",
    "item_retail_sale_rpt",
    "item_item_jama_nave",
    "item_barcode_stock_rpt",
    "item_dhadi_book",
    "item_owner_drawings",
  ],
  settings: [
    "item_firm_master",
    "item_branches",
    "item_users_settings",
    "item_customization",
    "item_workflow",
    "item_rate_master",
    "item_automation",
    "item_erp_audit",
  ],
};

export function isPrimaryNavItem(groupId: string, item: NavItemDef): boolean {
  const keys = PRIMARY_NAV_I18N_BY_GROUP[groupId];
  if (!keys) return true;
  return keys.includes(item.i18nKey);
}

/**
 * Split cascade tree into primary vs secondary **leaf** lists for progressive
 * disclosure UIs. Cascade folders themselves stay in the menubar tree.
 */
export function splitNavItemsForDisclosure(
  groupId: string,
  items: NavItemDef[],
  activeKey: string | null,
): { primary: NavItemDef[]; secondary: NavItemDef[] } {
  const leaves = collectNavLeaves(items);
  const primary: NavItemDef[] = [];
  const secondary: NavItemDef[] = [];

  for (const item of leaves) {
    const key = itemRouteKey(item);
    if (isPrimaryNavItem(groupId, item) || key === activeKey) {
      primary.push(item);
    } else {
      secondary.push(item);
    }
  }

  const seen = new Set<string>();
  const dedupedPrimary = primary.filter((item) => {
    const k = itemRouteKey(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const dedupedSecondary = secondary.filter((item) => !seen.has(itemRouteKey(item)));

  return { primary: dedupedPrimary, secondary: dedupedSecondary };
}

/** Prefer keeping folders intact for cascade UIs; only filter empty after permission. */
export function preserveCascadeStructure(items: NavItemDef[]): NavItemDef[] {
  return items.filter((item) => (isNavFolder(item) ? (item.children?.length ?? 0) > 0 : !!item.to));
}
