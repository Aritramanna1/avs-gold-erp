/**
 * Unified Print Engine — Print Context / Data Mapper.
 *
 * Generalizes the pattern job-card-engine.ts's buildJobCardData() already
 * established: one pure function per doc type turns a raw store record
 * into the flat, renderer-agnostic PrintDocumentData shape (types.ts), so
 * section renderers never know about a specific zustand store's field
 * names. `usePrintRecord.ts`'s existing docType->store resolution switch
 * is the reuse target when each doc type is actually migrated (Phase 1/2)
 * — this file only builds the registry mechanism and wires the two
 * example doc types used by default-templates.ts, to prove the contract
 * end-to-end without migrating any live route.
 */
import { useCreditNotes } from "@/lib/billing-documents-store";
import { paiseToRupees, useBilling } from "@/lib/billing-store";
import { useOrders } from "@/lib/orders-store";
import { usePeople } from "@/lib/people-store";
import { buildInvoicePrintData } from "./invoice-data";
import type { PrintContextBuilder, PrintDocType, PrintDocumentData } from "./types";

const invoiceBuilder: PrintContextBuilder = (recordId) => {
  const inv = useBilling.getState().invoices.find((i) => i.id === recordId);
  if (!inv) return null;
  return buildInvoicePrintData(inv);
};

const builders: Partial<Record<PrintDocType, PrintContextBuilder>> = {
  gst_invoice: invoiceBuilder,
  retail_invoice: invoiceBuilder,
  credit_note: (recordId) => {
    const note = useCreditNotes.getState().notes.find((n) => n.id === recordId);
    if (!note) return null;
    return {
      docType: "credit_note",
      docNumber: note.creditNoteNo,
      recordId: note.id,
      createdAt: note.createdAt,
      title: "Credit Note",
      fields: {
        customerName: note.customerName || "Walk-in Customer",
        invoiceNo: note.invoiceNo,
        amountLabel: `₹ ${paiseToRupees(note.amountPaise)}`,
        reasonText: note.reason || "—",
        statusText: note.status === "issued" ? "Issued" : "Cancelled",
      },
      tables: {},
      flags: {
        isIssued: note.status === "issued",
        isCancelled: note.status === "cancelled",
      },
      images: {},
      balances: {},
    };
  },

  order_slip: (recordId) => {
    const order = useOrders.getState().orders.find((o) => o.id === recordId);
    if (!order) return null;
    const customer = usePeople.getState().people.find((p) => p.id === order.customerId);
    return {
      docType: "order_slip",
      docNumber: order.orderNo,
      recordId: order.id,
      createdAt: order.createdAt,
      title: "Order Slip",
      fields: {
        customerName: customer?.fullName || "Walk-in Customer",
        customerPhone: customer?.phone || "—",
        customerGstin: customer?.gstin,
        notes: order.design?.notes,
      },
      tables: {
        items: [
          {
            description: order.item.itemName || order.item.category,
            grossWt: `${(order.item.grossMg / 1000).toFixed(3)} g`,
            netWt: `${(order.item.netMg / 1000).toFixed(3)} g`,
            purity: order.item.purity,
            fine: `${((order.item.netMg * order.item.purity) / 1_000_000).toFixed(3)} g`,
            amount: order.item.amountRupees ? `₹${order.item.amountRupees.toFixed(2)}` : "—",
          },
        ],
      },
      flags: {
        hasCustomerGstin: !!customer?.gstin,
        hasNotes: !!order.design?.notes,
      },
      images: {},
      balances: {
        gold: { previous: 0, in: 0, out: 0, closing: 0 },
        cash: { previous: 0, in: 0, out: 0, closing: 0 },
      },
    };
  },
};

/**
 * Resolves a doc type + record id into render-ready PrintDocumentData, or
 * null if either the doc type has no builder registered yet or the record
 * doesn't exist. Returning null (not throwing) matches usePrintRecord.ts's
 * existing "loading/not-found" convention, so PrintEngine can render the
 * same not-found state that route.
 */
export function resolvePrintContext(
  docType: PrintDocType,
  recordId: string,
): PrintDocumentData | null {
  const builder = builders[docType];
  if (!builder) return null;
  return builder(recordId);
}

export function hasPrintContextBuilder(docType: PrintDocType): boolean {
  return !!builders[docType];
}
