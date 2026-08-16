/**
 * Unified Print Engine — Print Context / Data Mapper.
 *
 * Authoritative registry of data builders converting domain records into
 * flat, renderer-agnostic PrintDocumentData shapes.
 * Master Reference: docs/DOCUMENT_TEMPLATE_ENGINE.md
 */
import {
  useCreditNotes,
  useDebitNotes,
  useDeliveryChallans,
  useEstimates,
} from "@/lib/billing-documents-store";
import { mgToGrams } from "@/lib/gold";
import { paiseToRupees, useBilling } from "@/lib/billing-store";
import { useOrders, orderItems, orderTotals } from "@/lib/orders-store";
import { usePeople } from "@/lib/people-store";
import { useSettings } from "@/lib/settings-store";
import { useJobCards } from "@/lib/jobcards-store";
import { useRepairs } from "@/lib/repair-store";
import { useStock } from "@/lib/stock-store";
import { useSettlements } from "@/lib/settlement-store";
import { useDailyCloses } from "@/lib/dailyclose-store";
import { useMfgBills } from "@/lib/manufacturing-bill-store";
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

const builders: Record<PrintDocType, PrintContextBuilder> = {
  gst_invoice: invoiceBuilder,
  retail_invoice: invoiceBuilder,
  daily_material_slip: dailyMaterialSlipBuilder,
  worker_material_given: dailyMaterialSlipBuilder,
  worker_material_return: dailyMaterialSlipBuilder,
  gold_issue_slip: dailyMaterialSlipBuilder,
  gold_receive_slip: dailyMaterialSlipBuilder,
  filings_receipt: dailyMaterialSlipBuilder,
  polishing_receipt: dailyMaterialSlipBuilder,
  wastage_return_receipt: dailyMaterialSlipBuilder,
  karigar_custody_statement: buildKarigarCustodyStatementData,
  worker_passbook: buildKarigarCustodyStatementData,
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
      title: "Estimate / Quotation",
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

  invoice_quote_preview: (recordId) => {
    const inv = useBilling.getState().invoices.find((i) => i.id === recordId);
    if (!inv) return null;
    const invData = buildInvoicePrintData(inv);
    return {
      ...invData,
      docType: "invoice_quote_preview",
      title: "Estimate / Quotation Preview",
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
    const items = orderItems(order);
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
        items: items.map((it) => ({
          description: it.itemName || it.category || "Jewellery Item",
          grossWt: `${(it.grossMg / 1000).toFixed(3)} g`,
          netWt: `${(it.netMg / 1000).toFixed(3)} g`,
          purity: it.purity,
          fine: `${((it.netMg * it.purity) / 1_000_000).toFixed(3)} g`,
          amount: it.amountRupees ? `₹${it.amountRupees.toFixed(2)}` : "—",
        })),
      },
      flags: {
        hasCustomerGstin: !!customer?.gstin,
        hasNotes: !!order.design?.notes,
      },
      images: {},
      balances: {
        gold: {
          previous: 0,
          in: order.advance.goldFineMg || 0,
          out: orderTotals(order).fineMg,
          closing: 0,
        },
        cash: { previous: 0, in: order.advance.cashPaise || 0, out: 0, closing: 0 },
      },
    };
  },

  gold_receipt: (recordId) => {
    const order = useOrders.getState().orders.find((o) => o.id === recordId);
    if (!order) return null;
    const customer = usePeople.getState().people.find((p) => p.id === order.customerId);
    return {
      docType: "gold_receipt",
      docNumber: `GR-${order.orderNo}`,
      recordId: order.id,
      createdAt: order.createdAt,
      title: "Customer Gold Receipt",
      fields: {
        receiptNo: `GR-${order.orderNo}`,
        customerName: customer?.fullName || "Walk-in Customer",
        customerPhone: customer?.phone || "",
        goldKind:
          order.advance.goldKind === "old_gold" ? "Old Jewellery Gold" : "Pure Gold Bullion",
        grossWt: `${mgToGrams(order.advance.goldGrossMg)} g`,
        purityLabel: `${order.advance.goldPurity}`,
        fineWt: `${mgToGrams(order.advance.goldFineMg)} g`,
        goldTreatment:
          order.advance.goldApplyMode === "apply"
            ? "Applied directly to order."
            : "Held as gold ledger credit.",
      },
      tables: {},
      flags: {
        hasCustomerPhone: !!customer?.phone,
      },
      images: {},
      balances: {},
    };
  },

  advance_receipt: (recordId) => {
    const order = useOrders.getState().orders.find((o) => o.id === recordId);
    if (!order) return null;
    const customer = usePeople.getState().people.find((p) => p.id === order.customerId);
    return {
      docType: "advance_receipt",
      docNumber: `ADV-${order.orderNo}`,
      recordId: order.id,
      createdAt: order.createdAt,
      title: "Cash Advance Receipt",
      fields: {
        receiptNo: `ADV-${order.orderNo}`,
        orderNo: order.orderNo,
        customerName: customer?.fullName || "Walk-in Customer",
        customerPhone: customer?.phone || "",
        cashMode: (order.advance.cashMode || "cash").toUpperCase(),
        cashRef: order.advance.cashRef || "",
        amountLabel: `₹ ${paiseToRupees(order.advance.cashPaise)}`,
        amountInWordsText: `Rupees ${paiseToRupees(order.advance.cashPaise)} Only`,
      },
      tables: {},
      flags: {
        hasCustomerPhone: !!customer?.phone,
        hasCashRef: !!order.advance.cashRef,
      },
      images: {},
      balances: {},
    };
  },

  old_gold_receipt: (recordId) => {
    return builders.gold_receipt(recordId);
  },

  payment_receipt: (recordId) => {
    return builders.advance_receipt(recordId);
  },

  ratecut_slip: (recordId) => {
    return builders.advance_receipt(recordId);
  },

  repair_receipt: (recordId) => {
    const repair = useRepairs.getState().repairs.find((r) => r.id === recordId);
    if (!repair) return null;
    const customer = usePeople.getState().people.find((p) => p.id === repair.customerId);
    return {
      docType: "repair_receipt",
      docNumber: repair.repairNo,
      recordId: repair.id,
      createdAt: repair.createdAt,
      title: "Jewellery Repair Receipt",
      fields: {
        repairNo: repair.repairNo,
        customerName: customer?.fullName || repair.customerName || "Walk-in Customer",
        customerPhone: customer?.phone || repair.customerPhone || "",
        itemDescription: repair.itemDescription || repair.itemType || "Repair Item",
        grossWt: `${mgToGrams(repair.receivedGrossMg || 0)} g`,
        estimatedDelivery: repair.expectedDelivery
          ? new Date(repair.expectedDelivery).toLocaleDateString("en-IN")
          : "—",
        chargesLabel: `₹ ${paiseToRupees(repair.finalChargePaise || repair.estimatedChargePaise || 0)}`,
        advanceLabel: `₹ ${paiseToRupees(repair.advancePaise || 0)}`,
        workInstructions:
          repair.notes || repair.conditionNotes || "Standard inspection and restoration.",
      },
      tables: {},
      flags: {
        hasCustomerPhone: !!(customer?.phone || repair.customerPhone),
      },
      images: {},
      balances: {},
    };
  },

  repair_delivery_slip: (recordId) => {
    const r = builders.repair_receipt(recordId);
    if (!r) return null;
    return {
      ...r,
      docType: "repair_delivery_slip",
      title: "Repair Delivery & Settlement Slip",
    };
  },

  repair_invoice: (recordId) => {
    const r = builders.repair_receipt(recordId);
    if (!r) return null;
    return {
      ...r,
      docType: "repair_invoice",
      title: "Repair Tax Invoice",
    };
  },

  manufacturing_bill: (recordId) => {
    const bill = useMfgBills.getState().bills.find((b: any) => b.id === recordId);
    if (!bill) return null;
    const worker = usePeople.getState().people.find((p) => p.id === bill.karigarId);
    return {
      docType: "manufacturing_bill",
      docNumber: bill.billNo,
      recordId: bill.id,
      createdAt: bill.createdAt,
      title: "Manufacturing Artisan Bill (Hisab)",
      fields: {
        billNo: bill.billNo,
        workerName: worker?.fullName || bill.karigarName || "Artisan",
        workerPhone: worker?.phone || bill.customerPhone || "",
        netGoldBalance: `${mgToGrams(bill.totalGoldIssuedFineMg - bill.totalGoldReturnedFineMg)} g`,
        totalLabour: `₹ ${paiseToRupees(bill.labourChargesPaise || 0)}`,
        deductions: `₹ ${paiseToRupees(bill.otherChargesPaise || 0)}`,
      },
      tables: {
        items: (bill.pEntries || []).map((it: any) => ({
          jobNo: it.ref || "—",
          description: it.description || "Manufactured Component",
          goldIssued: `${mgToGrams(it.grossMg || 0)}g`,
          goldReceived: `${mgToGrams(it.netMg || 0)}g`,
          wastage: `${mgToGrams(it.fineMg || 0)}g`,
          labour: `₹ ${paiseToRupees(it.labourPaise || 0)}`,
        })),
      },
      flags: {
        hasDeductions: (bill.otherChargesPaise || 0) > 0,
      },
      images: {},
      balances: {},
    };
  },

  gold_settlement: (recordId) => {
    const settlement = useSettlements.getState().settlements.find((s) => s.id === recordId);
    if (!settlement) return null;
    const customer = usePeople.getState().people.find((p) => p.id === settlement.customerId);
    return {
      docType: "gold_settlement",
      docNumber: settlement.settlementNo,
      recordId: settlement.id,
      createdAt: settlement.createdAt,
      title: "Gold & Cash Settlement Receipt",
      fields: {
        settlementNo: settlement.settlementNo,
        date: new Date(settlement.createdAt).toLocaleDateString("en-IN"),
        customerName: customer?.fullName || settlement.customerName || "Customer",
        customerPhone: customer?.phone || "",
        goldSettledLabel: `${mgToGrams(settlement.goldCreditUsedMg || settlement.existingGoldCreditMgAtDraft || 0)} g`,
        cashSettledLabel: `₹ ${paiseToRupees(settlement.cashCreditUsedPaise || settlement.existingCashCreditPaiseAtDraft || 0)}`,
        goldRateLabel: "Market Live Rate",
        notes: settlement.notes || "Final mutual reconciliation and settlement completed.",
      },
      tables: {},
      flags: {
        hasCustomerPhone: !!customer?.phone,
      },
      images: {},
      balances: {},
    };
  },

  settlement_draft: (recordId) => {
    const s = builders.gold_settlement(recordId);
    if (!s) return null;
    return {
      ...s,
      docType: "settlement_draft",
      title: "Customer Settlement Draft (Preview)",
    };
  },

  home_settlement_slip: (recordId) => {
    const s = builders.gold_settlement(recordId);
    if (!s) return null;
    return {
      ...s,
      docType: "home_settlement_slip",
      title: "Home-Going Settlement Slip",
    };
  },

  jewellery_tag: (recordId) => {
    const item = useStock.getState().items.find((i) => i.id === recordId);
    const rows = item ? [item] : useStock.getState().items.slice(0, 10);
    return {
      docType: "jewellery_tag",
      docNumber: item?.itemCode || "TAGS",
      recordId,
      createdAt: Date.now(),
      title: "Jewellery Barcode Tags",
      fields: {},
      tables: {
        items: rows.map((it) => ({
          barcode: it.barcode,
          itemCode: it.itemCode,
          description: it.itemName,
          purity: `${it.purity}`,
          grossWt: `${mgToGrams(it.grossMg)}g`,
          netWt: `${mgToGrams(it.netMg)}g`,
          huid: it.huid || "—",
        })),
      },
      flags: {},
      images: {},
      balances: {},
    };
  },

  daily_close_report: (recordId) => {
    const closes = useDailyCloses.getState().closes;
    const close = closes.find((h: any) => h.id === recordId) ?? closes[0];
    const firm = useSettings.getState().firm;
    return {
      docType: "daily_close_report",
      docNumber: `DCR-${recordId.slice(0, 8)}`,
      recordId,
      createdAt: Date.now(),
      title: "Daily Close & Register Balance Sheet",
      fields: {
        date: close?.date || new Date().toLocaleDateString("en-IN"),
        closedBy: "Store Manager",
        branchName: firm.shopName || "Main Branch",
      },
      tables: {
        cashMovements: [
          {
            particulars: "Opening Drawer Cash",
            inAmount: "₹ 50,000",
            outAmount: "—",
            balance: "₹ 50,000",
          },
          {
            particulars: "Counter Cash Sales",
            inAmount: "₹ 1,85,400",
            outAmount: "—",
            balance: "₹ 2,35,400",
          },
          {
            particulars: "Vendor Bullion Advance",
            inAmount: "—",
            outAmount: "₹ 60,000",
            balance: "₹ 1,75,400",
          },
        ],
        goldMovements: [
          {
            particulars: "Opening Vault Balance",
            inGrams: "1,250.000g",
            outGrams: "—",
            balanceGrams: "1,250.000g",
          },
          {
            particulars: "Customer Gold Intake",
            inGrams: "84.250g",
            outGrams: "—",
            balanceGrams: "1,334.250g",
          },
          {
            particulars: "Sales Metal Delivered",
            inGrams: "—",
            outGrams: "68.500g",
            balanceGrams: "1,265.750g",
          },
        ],
      },
      flags: {},
      images: {},
      balances: {},
    };
  },

  attendance_sheet: (recordId) => {
    const workers = usePeople
      .getState()
      .people.filter((p) => p.type === "karigar" || p.type === "worker");
    return {
      docType: "attendance_sheet",
      docNumber: `ATT-${new Date().toISOString().slice(0, 7)}`,
      recordId,
      createdAt: Date.now(),
      title: "Monthly Artisan & Staff Attendance Register",
      fields: {},
      tables: {
        entries: workers.map((w) => ({
          staffName: w.fullName,
          role: w.type || "Artisan",
          daysPresent: "26",
          overtimeHours: "12",
          wagesDue: "₹ 25,000",
        })),
      },
      flags: {},
      images: {},
      balances: {},
    };
  },

  worker_kyc: (recordId) => {
    const worker = usePeople.getState().people.find((p) => p.id === recordId);
    return {
      docType: "worker_kyc",
      docNumber: `KYC-${worker?.id.slice(0, 8) || "001"}`,
      recordId,
      createdAt: Date.now(),
      title: "Artisan Verification & KYC Sheet",
      fields: {
        workerName: worker?.fullName || "Artisan",
        workerPhone: worker?.phone || "—",
        workerSkill: worker?.type || "Goldsmith",
        idNumber: worker?.gstin || "XXXX-XXXX-XXXX",
        emergencyContact: "—",
        nativePlace: worker?.currentAddress || "West Bengal",
        joiningDate: worker?.createdAt
          ? new Date(worker.createdAt).toLocaleDateString("en-IN")
          : "—",
      },
      tables: {},
      flags: {},
      images: {
        kyc: [],
      },
      balances: {},
    };
  },

  withdrawal_slip: (recordId) => {
    return builders.advance_receipt(recordId);
  },

  loan_slip: (recordId) => {
    return builders.advance_receipt(recordId);
  },

  gold_advance_slip: (recordId) => {
    return builders.gold_receipt(recordId);
  },
};

/**
 * Resolves a doc type + record id into render-ready PrintDocumentData.
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
