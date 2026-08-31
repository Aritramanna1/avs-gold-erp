/**
 * Map Print Engine doc types → document_shares types for secure expiring links.
 */
import type { PrintDocType } from "@/lib/print-engine/types";
import type { ShareDocumentType } from "@/lib/document-shares";

/** Firm-scoped share table only accepts these document kinds. */
export function printDocTypeToShareDocumentType(
  docType: PrintDocType,
): ShareDocumentType | null {
  switch (docType) {
    case "retail_invoice":
    case "gst_invoice":
      return "invoice";
    case "estimate_doc":
    case "invoice_quote_preview":
      return "estimate";
    case "order_slip":
      return "order";
    case "repair_invoice":
      return "repair";
    case "manufacturing_bill":
      return "job";
    case "delivery_challan":
      return "delivery_challan";
    case "credit_note":
      return "credit_note";
    case "debit_note":
      return "debit_note";
    case "gold_settlement":
      return "gold_settlement";
    default:
      return null;
  }
}
