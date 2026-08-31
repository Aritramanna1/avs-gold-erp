/**
 * Maps comm / share requests to Universal Print Engine doc types.
 */
import type { CommRequest } from "@/lib/comm/types";
import type { Invoice } from "@/lib/billing-store";
import type { PrintDocType } from "@/lib/printlog-store";

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

export function resolvePrintDocTypeFromComm(
  req: Pick<CommRequest, "template" | "linkedType">,
  record?: unknown,
): PrintDocType | null {
  const { template, linkedType } = req;

  if (template === "delivery_challan" || linkedType === "delivery_challan") {
    return "delivery_challan";
  }
  if (linkedType === "credit_note") {
    return "credit_note";
  }
  if (linkedType === "debit_note") {
    return "debit_note";
  }
  if (
    template === "gold_settlement_reminder" ||
    template === "settlement_ready" ||
    template === "pending_settlement" ||
    linkedType === "gold_settlement"
  ) {
    return "gold_settlement";
  }

  if (linkedType === "estimate" || template === "estimate") {
    return "estimate_doc";
  }

  if (
    linkedType === "invoice" ||
    INVOICE_TEMPLATES.has(template)
  ) {
    const inv = record as Invoice | undefined;
    if (inv?.gst === "gst3") return "gst_invoice";
    return "retail_invoice";
  }

  if (linkedType === "order" || ORDER_TEMPLATES.has(template)) {
    return "order_slip";
  }

  if (linkedType === "repair" || template === "repair_ready") {
    return "repair_invoice";
  }

  if (linkedType === "job" || template === "manufacturing_bill") {
    return "manufacturing_bill";
  }

  return null;
}

export function resolvePrintDocTypeFromShare(
  shareDocType: string,
  docSnapshot: Record<string, unknown>,
): PrintDocType | null {
  if (shareDocType === "invoice") {
    return docSnapshot.gst === "gst3" ? "gst_invoice" : "retail_invoice";
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
