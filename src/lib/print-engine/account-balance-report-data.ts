/**
 * Offline-style Account Balance print data — prefers server RPC; falls back to client compile.
 */
import {
  accountBalanceTotals,
  compileAccountBalances,
  fmtOfflineCash,
  fmtOfflineWt,
  type AccountBalanceRow,
} from "@/lib/jewellery-books-reports";
import { fetchAccountBalances } from "@/lib/jewellery-books-query";
import { useSettings } from "@/lib/settings-store";
import type { PrintDocumentData } from "@/lib/print-engine/types";

function buildFromRows(
  variant: "1" | "2",
  rows: AccountBalanceRow[],
): PrintDocumentData {
  const totals = accountBalanceTotals(rows);
  const firm = useSettings.getState().firm;
  const firmName = firm?.shopName || firm?.brandName || firm?.legalName || "AVS ERP";

  const items = rows.map((r, i) => ({
    no: String(i + 1),
    name: r.partyName,
    phone: r.phone || "",
    jamaWt: fmtOfflineWt(r.jamaWtMg),
    returnWt: fmtOfflineWt(r.returnWtMg),
    naveWt: fmtOfflineWt(r.naveWtMg),
    cash: fmtOfflineCash(r.cashPaise),
    anamat: fmtOfflineCash(r.anamatPaise),
    fine: fmtOfflineWt(r.fineMg),
  }));

  const itemsTotals = [
    {
      no: "",
      name: "TOTAL",
      phone: "",
      jamaWt: fmtOfflineWt(totals.jamaWtMg),
      returnWt: fmtOfflineWt(totals.returnWtMg),
      naveWt: fmtOfflineWt(totals.naveWtMg),
      cash: fmtOfflineCash(totals.cashPaise),
      anamat: fmtOfflineCash(totals.anamatPaise),
      fine: fmtOfflineWt(totals.fineMg),
    },
  ];

  return {
    docType: "account_balance_report",
    docNumber: `AC-BAL-${variant}`,
    recordId: variant,
    createdAt: Date.now(),
    title: variant === "2" ? "Account Balance 2" : "Account Balance",
    fields: {
      firmName,
      reportTitle: variant === "2" ? "Account Balance 2" : "Account Balance",
      asOfLabel: new Date().toLocaleDateString("en-IN"),
      badgeTitle: "Account Balance",
    },
    tables: { items, itemsTotals },
    flags: {
      hasRows: rows.length > 0,
    },
    images: {},
    balances: {},
  };
}

export function buildAccountBalanceReportData(recordId: string): PrintDocumentData | null {
  const variant: "1" | "2" = recordId === "2" || recordId.endsWith(":2") ? "2" : "1";
  // Sync path for PrintEngine — client compile fallback until async print context lands.
  return buildFromRows(variant, compileAccountBalances(variant));
}

/** Prefer for async print / export pipelines. */
export async function buildAccountBalanceReportDataAsync(
  recordId: string,
): Promise<PrintDocumentData | null> {
  const variant: "1" | "2" = recordId === "2" || recordId.endsWith(":2") ? "2" : "1";
  try {
    const rows = await fetchAccountBalances(variant);
    return buildFromRows(variant, rows);
  } catch {
    return buildFromRows(variant, compileAccountBalances(variant));
  }
}
