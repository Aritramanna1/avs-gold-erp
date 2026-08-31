/**
 * Map print SPA URLs (used by triggerPrint) onto Print Engine doc types
 * so web and native preview never iframes / window.prints the print route UI.
 */
import type { PrintDocType } from "@/lib/printlog-store";
import { useBilling } from "@/lib/billing-store";

export interface MappedPrintDocument {
  docType: PrintDocType;
  recordId: string;
}

function invoiceDocType(recordId: string): PrintDocType {
  const inv = useBilling.getState().invoices.find((i) => i.id === recordId);
  return inv?.gst === "gst3" ? "gst_invoice" : "retail_invoice";
}

const REPAIR_KIND: Record<string, PrintDocType> = {
  receipt: "repair_receipt",
  delivery: "repair_delivery_slip",
  invoice: "repair_invoice",
  payment: "payment_receipt",
  "polishing-receipt": "polishing_receipt",
  "polishing-delivery": "repair_delivery_slip",
};

const ORDER_KIND: Record<string, PrintDocType> = {
  slip: "order_slip",
  "gold-receipt": "gold_receipt",
  "advance-receipt": "advance_receipt",
  "old-gold-receipt": "old_gold_receipt",
  "customer-gold": "gold_receipt",
  "old-gold": "old_gold_receipt",
  advance: "advance_receipt",
};

function match(path: string, pattern: RegExp): string[] | null {
  const m = path.match(pattern);
  return m ? m.slice(1) : null;
}

/** Normalize hash/file URLs to an app path (pathname only, no query). */
export function normalizePrintPath(printUrl: string): string {
  const raw = (printUrl || "").trim();
  if (!raw) return "";
  try {
    if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("file:")) {
      const u = new URL(raw);
      return (u.hash.replace(/^#/, "") || u.pathname).split("?")[0];
    }
  } catch {
    /* fall through */
  }
  return raw.replace(/^#/, "").split("?")[0];
}

/** Path + search params (needed for jewellery book date ranges). */
function parsePrintUrlParts(printUrl: string): { path: string; search: URLSearchParams } {
  const raw = (printUrl || "").trim().replace(/^#/, "");
  let pathAndQuery = raw;
  try {
    if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("file:")) {
      const u = new URL(raw);
      pathAndQuery = u.hash.replace(/^#/, "") || `${u.pathname}${u.search}`;
    }
  } catch {
    /* fall through */
  }
  const q = pathAndQuery.indexOf("?");
  const path = (q >= 0 ? pathAndQuery.slice(0, q) : pathAndQuery).split("?")[0];
  const search = new URLSearchParams(q >= 0 ? pathAndQuery.slice(q + 1) : "");
  return { path, search };
}

const BOOK_PRINT_DOC_TYPES = new Set([
  "cash_book",
  "fine_rojmel",
  "dar_rojmel",
  "karigar_book",
  "barcode_stock",
  "item_jama_nave",
  "dhadi_book",
  "daily_jewellery_summary",
]);

export function mapPrintUrlToDocument(printUrl: string): MappedPrintDocument | null {
  const { path, search } = parsePrintUrlParts(printUrl);
  if (!path) return null;

  let m = match(path, /^\/reports\/book-print\/([^/]+)/);
  if (m) {
    const docType = m[0] as PrintDocType;
    if (!BOOK_PRINT_DOC_TYPES.has(docType)) return null;
    const from = search.get("from") || "";
    const to = search.get("to") || from;
    const mode = search.get("mode") || undefined;
    const recordId =
      docType === "barcode_stock" && !from
        ? "all"
        : mode
          ? `${from}~${to}~${mode}`
          : `${from}~${to}`;
    return { docType, recordId };
  }

  m = match(path, /^\/reports\/account-balance-print\/([^/]+)/);
  if (m) return { docType: "account_balance_report", recordId: m[0] === "2" ? "2" : "1" };

  m = match(path, /^\/billing\/print\/([^/]+)/);
  if (m) return { docType: invoiceDocType(m[0]), recordId: m[0] };

  m = match(path, /^\/billing\/receipt\/([^/]+)/);
  if (m) return { docType: "payment_receipt", recordId: m[0] };

  m = match(path, /^\/billing\/estimate(?:-print)?\/([^/]+)/);
  if (m) return { docType: "estimate_doc", recordId: m[0] };

  m = match(path, /^\/billing\/credit-note-print\/([^/]+)/);
  if (m) return { docType: "credit_note", recordId: m[0] };

  m = match(path, /^\/billing\/debit-note-print\/([^/]+)/);
  if (m) return { docType: "debit_note", recordId: m[0] };

  m = match(path, /^\/billing\/delivery-challan-print\/([^/]+)/);
  if (m) return { docType: "delivery_challan", recordId: m[0] };

  m = match(path, /^\/billing\/gold-settlement-print\/([^/]+)/);
  if (m) return { docType: "gold_settlement", recordId: m[0] };

  m = match(path, /^\/people\/ledger-print\/([^/]+)/);
  if (m) return { docType: "customer_ledger_statement", recordId: m[0] };

  m = match(path, /^\/people\/print\/([^/]+)/);
  if (m) return { docType: "worker_kyc", recordId: m[0] };

  m = match(path, /^\/workshop\/gold-book-print\/([^/]+)/);
  if (m) return { docType: "karigar_custody_statement", recordId: m[0] };

  m = match(path, /^\/workshop\/print\/job-card\/([^/]+)/);
  if (m) return { docType: "job_card", recordId: m[0] };

  m = match(path, /^\/repair\/print\/([^/]+)\/([^/]+)/);
  if (m) {
    const docType = REPAIR_KIND[m[0]] ?? "repair_receipt";
    return { docType, recordId: m[1] };
  }

  m = match(path, /^\/orders\/print\/([^/]+)\/([^/]+)/);
  if (m) {
    const docType = ORDER_KIND[m[0]] ?? "order_slip";
    return { docType, recordId: m[1] };
  }

  m = match(path, /^\/stock\/print\/([^/]+)/);
  if (m) return { docType: "jewellery_tag", recordId: m[0] };

  m = match(path, /^\/settlement\/draft-print\/([^/]+)/);
  if (m) return { docType: "settlement_draft", recordId: m[0] };

  m = match(path, /^\/billing\/settlement-slip\/([^/]+)/);
  if (m) return { docType: "settlement_draft", recordId: m[0] };

  m = match(path, /^\/workshop\/receive-slip\/([^/]+)/);
  if (m) return { docType: "gold_receive_slip", recordId: m[0] };

  m = match(path, /^\/workshop\/filings-slip\/([^/]+)/);
  if (m) return { docType: "filings_receipt", recordId: m[0] };

  m = match(path, /^\/workshop\/material-slip\/([^/]+)\/([^/]+)/);
  if (m) return { docType: "daily_material_slip", recordId: `${m[0]}~${m[1]}` };

  m = match(path, /^\/manufacturing\/bill\/([^/]+)/);
  if (m) return { docType: "manufacturing_bill", recordId: m[0] };

  m = match(path, /^\/reports\/dailyclose-print\/([^/]+)/);
  if (m) return { docType: "daily_close_report", recordId: m[0] };

  m = match(path, /^\/platform\/billing-print\/([^/]+)/);
  if (m) return { docType: "platform_tax_invoice", recordId: m[0] };

  return null;
}
