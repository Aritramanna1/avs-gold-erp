/**
 * Maps communication / share document kinds → PrintEngine doc types.
 * Recovered from production-dist-shop/assets/comm-print-resolver-*.js
 */

const INVOICE_TEMPLATES = new Set([
  "invoice",
  "receipt",
  "estimate",
  "advance_receipt",
  "payment_reminder",
]);

const ORDER_TEMPLATES = new Set([
  "order_confirmation",
  "order_ready",
  "order_delivered",
]);

export type CommPrintResolveInput = {
  template: string;
  linkedType?: string | null;
};

export type GstKindLike = { gst?: string } | null | undefined;

/** Resolve print doc type from a communication template + linked entity. */
export function resolvePrintDocTypeFromComm(
  input: CommPrintResolveInput,
  partyOrInvoice?: GstKindLike,
): string | null {
  const { template, linkedType } = input;
  const a = linkedType ?? undefined;

  if (template === "delivery_challan" || a === "delivery_challan") return "delivery_challan";
  if (a === "credit_note") return "credit_note";
  if (a === "debit_note") return "debit_note";
  if (
    template === "gold_settlement_reminder" ||
    template === "settlement_ready" ||
    template === "pending_settlement" ||
    a === "gold_settlement"
  ) {
    return "gold_settlement";
  }
  if (a === "estimate" || template === "estimate") return "estimate_doc";
  if (a === "invoice" || INVOICE_TEMPLATES.has(template)) {
    return partyOrInvoice?.gst === "gst3" ? "gst_invoice" : "retail_invoice";
  }
  if (a === "order" || ORDER_TEMPLATES.has(template)) return "order_slip";
  if (a === "repair" || template === "repair_ready") return "repair_invoice";
  if (a === "job" || template === "manufacturing_bill") return "manufacturing_bill";
  return null;
}

/** Resolve print doc type from a share document_type string. */
export function resolvePrintDocTypeFromShare(
  shareDocType: string,
  partyOrInvoice: GstKindLike,
): string | null {
  if (shareDocType === "invoice") {
    return partyOrInvoice?.gst === "gst3" ? "gst_invoice" : "retail_invoice";
  }
  if (shareDocType === "estimate") return "estimate_doc";
  if (shareDocType === "order") return "order_slip";
  if (shareDocType === "repair") return "repair_invoice";
  if (shareDocType === "job") return "manufacturing_bill";
  if (shareDocType === "delivery_challan") return "delivery_challan";
  if (shareDocType === "credit_note") return "credit_note";
  if (shareDocType === "debit_note") return "debit_note";
  if (shareDocType === "gold_settlement") return "gold_settlement";
  return null;
}
