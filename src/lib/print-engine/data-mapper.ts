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
import {
  useCreditNotes,
  useDebitNotes,
  useDeliveryChallans,
  useEstimates,
} from "@/lib/billing-documents-store";
import { mgToGrams } from "@/lib/gold";
import { paiseToRupees, useBilling } from "@/lib/billing-store";
import { useOrders, orderItems } from "@/lib/orders-store";
import { usePeople } from "@/lib/people-store";
import { useSettings } from "@/lib/settings-store";
import { useJobCards } from "@/lib/jobcards-store";
import { buildJobCardData } from "@/lib/job-card-engine";
import { buildInvoicePrintData } from "./invoice-data";
import {
  buildKarigarCustodyStatementData,
  buildCustomerLedgerStatementData,
} from "./ledger-statements-data";
import { findWorkerSlip } from "@/lib/daily-material-slip";
import { getCaratLabel } from "@/lib/gold";
import type { PrintContextBuilder, PrintDocType, PrintDocumentData } from "./types";

function purityLabel(p: number): string {
  if (p >= 990) return "999 (24K)";
  if (p >= 915) return "916 (22K)";
  if (p >= 749) return "750 (18K)";
  if (p >= 584) return "585 (14K)";
  return `${p}`;
}

const ESTIMATE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  converted: "Converted",
  cancelled: "Cancelled",
  expired: "Expired",
};

const CHALLAN_STATUS_LABELS: Record<string, string> = {
  issued: "Issued",
  returned: "Returned",
  cancelled: "Cancelled",
  converted_to_invoice: "Converted",
};

const invoiceBuilder: PrintContextBuilder = (recordId) => {
  const inv = useBilling.getState().invoices.find((i) => i.id === recordId);
  if (!inv) return null;
  return buildInvoicePrintData(inv);
};

/** Daily Material Slip — recordId is `${workerId}~${date}` (the slip's identity). */
const dailyMaterialSlipBuilder: PrintContextBuilder = (recordId) => {
  const [workerId, date] = recordId.split("~");
  const slip = workerId && date ? findWorkerSlip(workerId, date) : null;
  if (!slip) return null;
  const g = (mg: number) => `${mgToGrams(mg)} g`;
  const rowFrom = (e: (typeof slip.issues)[number]) => ({
    voucher: e.entryNo,
    time: e.time,
    particulars: e.particulars,
    net: mgToGrams(e.netMg),
    purity: e.purity > 0 ? getCaratLabel(e.purity) : "—",
    fine: e.fineMg > 0 ? mgToGrams(e.fineMg) : "—",
    qty: e.quantity > 0 ? String(e.quantity) : "—",
  });
  return {
    docType: "daily_material_slip",
    docNumber: slip.slipNumber,
    recordId,
    createdAt: slip.lastActivityTs,
    title: "Daily Material Slip",
    fields: {
      slipNumber: slip.slipNumber,
      dateLabel: slip.date,
      workerName: slip.workerName,
      transactionCount: String(slip.transactionCount),
      totalIssued: g(slip.totalIssuedFineMg),
      totalReturned: g(slip.totalReturnedFineMg),
      openingBalance: g(slip.custodyBalanceBeforeMg),
      netMovement: g(slip.totalIssuedFineMg - slip.totalReturnedFineMg),
      custodyBalance: g(slip.custodyBalanceAfterMg),
    },
    tables: {
      issues: slip.issues.map(rowFrom),
      returns: slip.returns.map(rowFrom),
    },
    flags: {},
    images: {},
    balances: {},
  };
};

const builders: Partial<Record<PrintDocType, PrintContextBuilder>> = {
  gst_invoice: invoiceBuilder,
  daily_material_slip: dailyMaterialSlipBuilder,
  retail_invoice: invoiceBuilder,
  karigar_custody_statement: buildKarigarCustodyStatementData,
  customer_ledger_statement: buildCustomerLedgerStatementData,
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

  debit_note: (recordId) => {
    const note = useDebitNotes.getState().notes.find((n) => n.id === recordId);
    if (!note) return null;
    return {
      docType: "debit_note",
      docNumber: note.debitNoteNo,
      recordId: note.id,
      createdAt: note.createdAt,
      title: "Debit Note",
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

  estimate_doc: (recordId) => {
    const est = useEstimates.getState().estimates.find((e) => e.id === recordId);
    if (!est) return null;
    return {
      docType: "estimate_doc",
      docNumber: est.estimateNo,
      recordId: est.id,
      createdAt: est.createdAt,
      title: "Estimate",
      fields: {
        customerName: est.customerName || "Walk-in Customer",
        customerPhone: est.customerPhone || "",
        statusText: ESTIMATE_STATUS_LABELS[est.status] ?? est.status,
        subtotalLabel: `₹ ${paiseToRupees(est.subtotalPaise)}`,
        gstLabel: `₹ ${paiseToRupees(est.gstPaise)}`,
        grandTotalLabel: `₹ ${paiseToRupees(est.grandTotalPaise)}`,
        notesText: est.notes || "",
        validityText:
          "Valid for 15 days from the date of issue. Prices subject to gold rate at time of order confirmation.",
      },
      tables: {
        items: est.items.map((it) => ({
          itemName: it.itemName,
          fineWt: `${mgToGrams(it.fineMg)}g`,
          amountLabel: `₹ ${paiseToRupees(it.lineTotalPaise)}`,
        })),
      },
      flags: {
        hasCustomerPhone: !!est.customerPhone,
        hasGst: est.gstPaise > 0,
        hasNotes: !!est.notes,
      },
      images: {},
      balances: {},
    };
  },

  delivery_challan: (recordId) => {
    const c = useDeliveryChallans.getState().challans.find((x) => x.id === recordId);
    if (!c) return null;
    return {
      docType: "delivery_challan",
      docNumber: c.challanNo,
      recordId: c.id,
      createdAt: c.createdAt,
      title: "Delivery Challan",
      fields: {
        customerName: c.customerName || "Walk-in Customer",
        statusText: CHALLAN_STATUS_LABELS[c.status] ?? c.status,
        notesText: c.notes || "",
        purposeText: `Goods sent for ${c.purpose.replace(/_/g, " ")} — not a tax invoice.`,
      },
      tables: {
        items: c.items.map((it) => ({
          itemName: it.itemName,
          qty: it.qty,
          grossWt: `${mgToGrams(it.grossMg)}g`,
          netWt: `${mgToGrams(it.netMg)}g`,
          purity: String(it.purity),
          fineWt: `${mgToGrams(it.fineMg)}g`,
        })),
      },
      flags: {
        hasNotes: !!c.notes,
      },
      images: {},
      balances: {},
    };
  },

  job_card: (recordId) => {
    // recordId is a JOB CARD id — one card per order line, so an order with
    // three pieces has three distinct cards and printing must be able to name
    // WHICH one. An Order id is still accepted (older links, and orders whose
    // cards aren't created yet), and resolves to that order's first card.
    const jobs = useJobCards.getState().jobs;
    const linkedJob = jobs.find((j) => j.id === recordId) ?? null;

    const orderId = linkedJob?.orderId ?? recordId;
    const order = useOrders.getState().orders.find((o) => o.id === orderId);
    if (!order) return null;

    const job = linkedJob ?? jobs.find((j) => j.orderId === order.id) ?? null;

    const people = usePeople.getState().people;
    const customer = people.find((p) => p.id === order.customerId);
    const karigar = order.karigarId ? people.find((p) => p.id === order.karigarId) : null;

    const jc = buildJobCardData(
      order,
      job,
      customer?.fullName ?? "—",
      customer?.phone,
      karigar?.fullName ?? null,
    );

    // Which of the order's pieces this card is for — printed on the card so a
    // karigar holding one of three knows it, and so two cards from the same
    // order are never mistaken for duplicates of each other.
    const items = orderItems(order);
    const lineIndex = job?.lineId ? items.findIndex((it) => it.lineId === job.lineId) : 0;
    const lineLabel =
      items.length > 1 && lineIndex >= 0 ? `Item ${lineIndex + 1} of ${items.length}` : "";

    return {
      docType: "job_card",
      docNumber: jc.jobCardNo || jc.productionOrderNo,
      recordId: job?.id ?? order.id,
      createdAt: order.createdAt,
      title: "JOB CARD",
      fields: {
        customerLine: jc.customerName + (jc.customerPhone ? ` (${jc.customerPhone})` : ""),
        assignedWorkerName: jc.assignedWorkerName || "Unassigned",
        itemName: jc.itemName,
        itemDescription: jc.itemDescription,
        lineLabel,
        quantityLabel: String(job?.quantity ?? items[Math.max(0, lineIndex)]?.quantity ?? 1),
        targetNetWt: `${mgToGrams(jc.targetNetMg)} g`,
        purityLabel: purityLabel(jc.purity),
        goldReceivedLabel:
          jc.goldReceivedFineMg > 0 ? `${mgToGrams(jc.goldReceivedFineMg)} g fine` : "None",
        targetGrossWt: `${mgToGrams(jc.targetGrossMg)} g`,
        expectedStartLabel: jc.expectedStart
          ? new Date(jc.expectedStart).toLocaleDateString("en-IN")
          : "—",
        expectedDeliveryLabel: jc.expectedDelivery
          ? new Date(jc.expectedDelivery).toLocaleDateString("en-IN")
          : "—",
        priorityLabel: job?.priority ?? "—",
        remarksText: jc.remarks || "—",
        productionOrderNo: jc.productionOrderNo,
        footerLine: `Production Order: ${jc.productionOrderNo} · ${useSettings.getState().firm.shopName || "Jewellers ERP"}`,
      },
      tables: {},
      flags: {
        hasItemDescription: !!jc.itemDescription,
        hasReferenceImages: jc.referenceImages.length > 0,
      },
      images: {
        reference: jc.referenceImages,
      },
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
