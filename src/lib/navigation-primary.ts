import type { NavItemDef } from "./navigation-groups";
import { collectNavLeaves, itemRouteKey, isNavFolder } from "./navigation-groups";

/**
 * Daily-use form i18n keys per Offline ERP menu — used when flattening cascade
 * trees for progressive disclosure (phone drawer / secondary lists).
 */
export const PRIMARY_NAV_I18N_BY_GROUP: Record<string, readonly string[]> = {
  home: ["item_dashboard"],
  master: [
    "item_firm_master",
    "item_item_masters",
    "item_customers",
    "item_suppliers",
    "item_karigars",
    "item_catalog",
    "item_rate_master",
    "item_opening_fine_cash",
  ],
  transaction: [
    "item_sales",
    "item_purchases",
    "item_receipt_jama",
    "item_payment_nave",
    "item_gold_settlement",
    "item_gold_book",
  ],
  payroll: ["item_employees", "item_attendance"],
  barcode: ["item_barcode", "item_barcode_scan", "item_ready_stock", "item_stock_audit"],
  utility: [
    "item_rate_master",
    "item_bank_rec",
    "item_cheque_print",
    "item_cheque_register",
    "item_cheque_checkbook",
    "item_gst_calc",
    "item_migration",
    "item_backup",
  ],
  reports: [
    "item_daily_summary",
    "item_accountwise",
    "item_item_jama_nave",
    "item_fine_rojmel",
    "item_cash_book",
    "item_account_balance",
  ],
  production: ["item_job_cards", "item_gold_book", "item_orders", "item_mfg_books", "item_jangad"],
  "gst-estimate": ["item_retail_sale", "item_estimates", "item_dc", "item_urd"],
  scheme: ["item_scheme_plans", "item_scheme_accounts", "item_scheme_receipts"],
  bullion: ["item_sauda", "item_bullion_ledger"],
  "avs-platform": ["item_crm", "item_customization", "item_assistant", "item_notifications", "item_help"],
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
