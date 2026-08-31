/**
 * Offline jewellery book → UPE PrintDocumentData (sync compile fallbacks).
 * recordId encoding: `from~to` or `from~to~mode` (mode optional).
 */
import {
  compileDarRojmel,
  compileDailySummary,
  compileFineRojmel,
  compileItemJamaNave,
  fmtOfflineCash,
  fmtOfflineWt,
  mgToGrams,
} from "@/lib/jewellery-books-reports";
import {
  compileCompanyCashLedger,
  companyCashLedgerOpeningPaise,
} from "@/lib/company-cash-ledger";
import { paiseToRupees } from "@/lib/billing-store";
import { useSettings } from "@/lib/settings-store";
import { useWorkerGoldBook } from "@/lib/worker-gold-book-store";
import { useStock } from "@/lib/stock-store";
import type { PrintDocType, PrintDocumentData } from "@/lib/print-engine/types";
import type { DateRange } from "@/lib/report-engine";

export function parseBookRangeId(recordId: string): DateRange & { mode?: string } {
  const parts = recordId.split("~");
  const from = parts[0] || "";
  const to = parts[1] || parts[0] || "";
  const mode = parts[2];
  return { from, to, mode };
}

function firmName(): string {
  const firm = useSettings.getState().firm;
  return firm?.shopName || firm?.brandName || firm?.legalName || "AVS ERP";
}

function bookShell(
  docType: PrintDocType,
  recordId: string,
  title: string,
  lines: Record<string, string>[],
  extras?: { openingLabel?: string; closingLabel?: string },
): PrintDocumentData {
  const range = parseBookRangeId(recordId);
  return {
    docType,
    docNumber: `${docType}-${range.from || "all"}`,
    recordId,
    createdAt: Date.now(),
    title,
    fields: {
      firmName: firmName(),
      reportTitle: title,
      periodLabel: range.from && range.to ? `${range.from} → ${range.to}` : "All dates",
      openingLabel: extras?.openingLabel || "",
      closingLabel: extras?.closingLabel || "",
      badgeTitle: title,
    },
    tables: { lines },
    flags: {
      hasRows: lines.length > 0,
      hasOpening: !!extras?.openingLabel,
      hasClosing: !!extras?.closingLabel,
    },
    images: {},
    balances: {},
  };
}

export function buildFineRojmelPrintData(recordId: string): PrintDocumentData {
  const range = parseBookRangeId(recordId);
  const compiled = compileFineRojmel(range);
  const lines = compiled.rows.map((r) => ({
    c1: r.date,
    c2: r.voucherNo,
    c3: r.narration,
    c4: mgToGrams(r.inMg),
    c5: mgToGrams(r.outMg),
    c6: mgToGrams(r.closingMg),
  }));
  return bookShell("fine_rojmel", recordId, "Fine Rojmel", lines, {
    openingLabel: `Opening fine ${mgToGrams(compiled.openingMg)} g`,
    closingLabel: `Closing fine ${mgToGrams(compiled.closingMg)} g`,
  });
}

export function buildDarRojmelPrintData(recordId: string): PrintDocumentData {
  const range = parseBookRangeId(recordId);
  const compiled = compileDarRojmel(range);
  const lines = compiled.rows.map((r) => ({
    c1: r.date,
    c2: r.voucherNo,
    c3: `${r.partyName} · ${r.narration}`,
    c4: fmtOfflineCash(r.jamaPaise),
    c5: fmtOfflineCash(r.navePaise),
    c6: fmtOfflineCash(r.closingPaise),
  }));
  return bookShell("dar_rojmel", recordId, "Dar Rojmel", lines, {
    openingLabel: `Opening ${fmtOfflineCash(compiled.openingPaise)}`,
    closingLabel: `Closing ${fmtOfflineCash(compiled.closingPaise)}`,
  });
}

export function buildCashBookPrintData(recordId: string): PrintDocumentData {
  const range = parseBookRangeId(recordId);
  const rows = compileCompanyCashLedger({ dateRange: range });
  const opening = companyCashLedgerOpeningPaise({ dateRange: range });
  let inPaise = 0;
  let outPaise = 0;
  const lines = rows.map((r) => {
    inPaise += r.debitPaise;
    outPaise += r.creditPaise;
    return {
      c1: r.date,
      c2: r.voucherNo || r.id.slice(0, 8),
      c3: r.description || r.partyName || "—",
      c4: r.debitPaise ? paiseToRupees(r.debitPaise) : "—",
      c5: r.creditPaise ? paiseToRupees(r.creditPaise) : "—",
      c6: paiseToRupees(r.closingPaise),
    };
  });
  return bookShell("cash_book", recordId, "Company Cash Book", lines, {
    openingLabel: `Opening ${paiseToRupees(opening)}`,
    closingLabel: `In ${paiseToRupees(inPaise)} · Out ${paiseToRupees(outPaise)}`,
  });
}

export function buildItemJamaNavePrintData(recordId: string): PrintDocumentData {
  const range = parseBookRangeId(recordId);
  const mode = range.mode === "account" ? "account" : "item";
  const rows = compileItemJamaNave(range, mode);
  const lines = rows.map((r) => ({
    c1: r.label,
    c2: fmtOfflineWt(r.saleFineMg),
    c3: fmtOfflineWt(r.purchaseFineMg),
    c4: fmtOfflineCash(r.salePaise),
    c5: fmtOfflineCash(r.purchasePaise),
    c6: String(r.saleCount + r.purchaseCount),
  }));
  return bookShell(
    "item_jama_nave",
    recordId,
    mode === "account" ? "Account-wise Jama Nave" : "Item-wise Jama Nave",
    lines,
  );
}

export function buildDailyJewellerySummaryPrintData(recordId: string): PrintDocumentData {
  const range = parseBookRangeId(recordId);
  const rows = compileDailySummary(range);
  const lines = rows.map((r) => ({
    c1: r.date,
    c2: mgToGrams(r.goldInMg),
    c3: mgToGrams(r.goldOutMg),
    c4: fmtOfflineCash(r.cashInPaise),
    c5: fmtOfflineCash(r.cashOutPaise),
    c6: `${fmtOfflineCash(r.salesPaise)} (${r.salesCount})`,
  }));
  return bookShell("daily_jewellery_summary", recordId, "Daily Summary", lines);
}

export function buildKarigarBookPrintData(recordId: string): PrintDocumentData {
  const range = parseBookRangeId(recordId);
  const entries = useWorkerGoldBook.getState().entries.filter((e) => {
    if (range.from && e.date < range.from) return false;
    if (range.to && e.date > range.to) return false;
    if (range.mode && e.workerId !== range.mode) return false;
    return true;
  });
  const lines = entries.map((e) => ({
    c1: e.date,
    c2: e.entryNo,
    c3: e.workerName,
    c4: e.type === "given" ? "Nave" : "Jama",
    c5: mgToGrams(e.netMg),
    c6: mgToGrams(e.fineMg),
  }));
  return bookShell("karigar_book", recordId, "Karigar Book", lines);
}

export function buildBarcodeStockPrintData(recordId: string): PrintDocumentData {
  const items = useStock.getState().items.filter((i) => i.barcode || i.itemCode);
  const lines = items.slice(0, 2000).map((it) => ({
    c1: it.barcode || it.itemCode,
    c2: it.itemName,
    c3: String(it.purity),
    c4: mgToGrams(it.grossMg),
    c5: mgToGrams(it.netMg),
    c6: it.huid || "—",
  }));
  return bookShell("barcode_stock", recordId || "all", "Barcode Stock", lines);
}

export function buildDhadiBookPrintData(recordId: string): PrintDocumentData {
  // Same worker gold-book lines as karigar book until a dedicated dhadi compiler lands;
  // keep PrintDocType distinct so Settings templates can target Dhadi.
  const base = buildKarigarBookPrintData(recordId);
  const range = parseBookRangeId(recordId);
  return {
    ...base,
    docType: "dhadi_book",
    docNumber: `dhadi_book-${range.from || "all"}`,
    title: "Dhadi Book",
    fields: {
      ...base.fields,
      reportTitle: "Dhadi Book",
      badgeTitle: "Dhadi Book",
    },
  };
}

/** Encode range for PrintEngine recordId / print URLs. */
export function encodeBookPrintId(from: string, to: string, mode?: string): string {
  if (mode) return `${from}~${to}~${mode}`;
  return `${from}~${to}`;
}
