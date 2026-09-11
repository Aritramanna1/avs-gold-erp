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
  buildCustomerUnpaidInvoicesData,
  buildCustomerPaidInvoicesData,
} from "./ledger-statements-data";
import { buildAccountBalanceReportData } from "./account-balance-report-data";
import {
  buildBarcodeStockPrintData,
  buildCashBookPrintData,
  buildDailyJewellerySummaryPrintData,
  buildDarRojmelPrintData,
  buildDhadiBookPrintData,
  buildFineRojmelPrintData,
  buildItemJamaNavePrintData,
  buildKarigarBookPrintData,
} from "./jewellery-books-print-data";
import { buildCustomerSettlementSlipData } from "@/lib/customer-settlement-slip";
import { useWorkers } from "@/lib/workers-store";
import { calculateKarigarPeriodSettlement } from "@/lib/karigar-period-settlement";
import { useMetalConversion } from "@/lib/metal-conversion-store";
import { findWorkerSlip } from "@/lib/daily-material-slip";
import { getCaratLabel } from "@/lib/gold";
import { usePlatformPrintStore } from "@/lib/platform-print-store";
import { useManufacturingBarcodes } from "@/lib/manufacturing-barcode-store";
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

function findJobCard(recordId: string) {
  return useJobCards
    .getState()
    .jobs.find((j) => j.id === recordId || j.id.toLowerCase() === recordId.toLowerCase());
}

const jobGoldReceiveSlipBuilder: PrintContextBuilder = (recordId) => {
  const job = findJobCard(recordId);
  const r = job?.workReceipt;
  if (!job || !r) return null;
  const karigar = job.karigarId
    ? usePeople.getState().people.find((p) => p.id === job.karigarId)
    : null;
  const g = (mg: number) => `${mgToGrams(mg)} g`;
  const row = (label: string, gross: number, purity: number, fine: number) => ({
    voucher: r.slipNo,
    time: new Date(r.ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    particulars: label,
    net: gross > 0 ? g(gross) : "—",
    purity: purity > 0 ? purityLabel(purity) : "—",
    fine: g(fine),
    qty: "1",
  });
  return {
    docType: "gold_receive_slip",
    docNumber: r.slipNo,
    recordId: job.id,
    createdAt: r.ts,
    title: "Gold Receive Slip",
    fields: {
      slipNumber: r.slipNo,
      dateLabel: new Date(r.ts).toLocaleString("en-IN"),
      workerName: karigar?.fullName ?? job.karigarName ?? "—",
      workerPhone: karigar?.phone || "",
      transactionCount: "1",
      totalIssued: g(job.targetFineMg || 0),
      totalReturned: g(r.finishedFineMg + r.scrapFineMg + r.filingsFineMg + r.dustFineMg),
      jobNo: job.jobNo,
      orderNo: job.orderNo,
      itemName: job.itemName,
      expectedLoss: g(r.expectedLossMg),
      actualLoss: g(r.actualLossMg),
      overloss: g(r.overlossMg),
      notes: r.notes || "",
    },
    tables: {
      issues: [],
      returns: [
        row("Finished Ornament", r.finishedGrossMg, r.finishedPurity, r.finishedFineMg),
        row("Scrap returned", r.scrapGrossMg, r.scrapPurity, r.scrapFineMg),
        row("Filings returned", r.filingsGrossMg, r.filingsPurity, r.filingsFineMg),
        ...(r.dustFineMg > 0 ? [row("Dust returned", 0, 0, r.dustFineMg)] : []),
      ],
    },
    flags: { hasNotes: !!r.notes, hasWorkerPhone: !!karigar?.phone },
    images: {},
    balances: {},
  };
};

const jobFilingsReceiptBuilder: PrintContextBuilder = (recordId) => {
  const base = jobGoldReceiveSlipBuilder(recordId);
  if (!base) return null;
  const job = findJobCard(recordId);
  const r = job?.workReceipt;
  if (!r || r.filingsFineMg <= 0) return null;
  return {
    ...base,
    docType: "filings_receipt",
    title: "Filings Receipt",
    fields: {
      ...base.fields,
      totalReturned: `${mgToGrams(r.filingsFineMg)} g`,
    },
    tables: {
      issues: [],
      returns: [
        {
          voucher: r.slipNo,
          time: new Date(r.ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
          particulars: "Filings returned",
          net: `${mgToGrams(r.filingsGrossMg)} g`,
          purity: purityLabel(r.filingsPurity),
          fine: `${mgToGrams(r.filingsFineMg)} g`,
          qty: "1",
        },
      ],
    },
  };
};

const customerSettlementSlipBuilder: PrintContextBuilder = (recordId) => {
  // Check if it's a Karigar settlement first
  const workerSettlement = useWorkers.getState().settlements.find((s) => s.id === recordId);
  if (workerSettlement) {
    const worker = usePeople.getState().people.find((p) => p.id === workerSettlement.workerId);
    const periodCalc = calculateKarigarPeriodSettlement(
      workerSettlement.workerId,
      workerSettlement.fromDate,
      workerSettlement.toDate,
    );

    return {
      docType: "home_settlement_slip",
      docNumber: `SETTLE-${workerSettlement.id.slice(-6).toUpperCase()}`,
      recordId: workerSettlement.id,
      createdAt: workerSettlement.createdAt,
      title: "Karigar Period Settlement Statement",
      fields: {
        settlementNo: `SETTLE-${workerSettlement.id.slice(-6).toUpperCase()}`,
        date: `${workerSettlement.fromDate} → ${workerSettlement.toDate}`,
        customerName: worker?.fullName || "Karigar",
        customerPhone: worker?.phone || "",
        goldSettledLabel: `${mgToGrams(workerSettlement.wageNetMg ?? 0)} g fine`,
        cashSettledLabel: `₹ ${paiseToRupees(workerSettlement.finalCashPayablePaise)}`,
        goldRateLabel: `Working Days: ${workerSettlement.daysWorked ?? workerSettlement.presentDays}`,
        notes: workerSettlement.notes || `Period Settlement for ${worker?.fullName}`,
        previousGoldBalance: `${mgToGrams(workerSettlement.goldAdvanceFineMg)} g adv`,
        closingGoldBalance: `${mgToGrams(workerSettlement.netGoldMg)} g`,
      },
      tables: {
        items: periodCalc && periodCalc.purityBooks.length > 0
          ? periodCalc.purityBooks.map((pb) => ({
              description: `${pb.label} (${pb.purity}‰)`,
              grossWt: `${mgToGrams(pb.netWorkDoneGrossMg)} g`,
              netWt: `${mgToGrams(pb.grossWorkerEarningMg)} g`,
              purity: `${pb.workerEarningPct}%`,
              amountLabel: `${mgToGrams(pb.netWorkerEarningMg)} g net`,
            }))
          : [
              {
                description: "Work Done",
                grossWt: `${mgToGrams(workerSettlement.gramsWorkedMg ?? 0)} g`,
                netWt: `${mgToGrams(workerSettlement.wageGrossMg ?? 0)} g`,
                purity: "0.50%",
                amountLabel: `${mgToGrams(workerSettlement.wageNetMg ?? 0)} g`,
              },
            ],
      },
      flags: {
        hasCustomerPhone: !!worker?.phone,
        hasBalance: false,
        hasNotes: !!workerSettlement.notes,
        isPureGold: false,
        hasCash: true,
      },
      images: {},
      balances: {},
    };
  }

  const inv = useBilling.getState().invoices.find((i) => i.id === recordId);
  if (!inv) return null;
  const slip = buildCustomerSettlementSlipData(inv);
  const isPureGold =
    inv.transactionMode === "gold" ||
    (inv.transactionMode !== "cash" &&
      (inv.billingType === "job_work" ||
        inv.billingType === "wholesale" ||
        slip.cashReceivedPaise === 0));

  return {
    docType: "home_settlement_slip",
    docNumber: slip.settlementNo,
    recordId: inv.id,
    createdAt: slip.date,
    title: isPureGold ? "Gold Settlement Statement" : "Customer Settlement Statement",
    fields: {
      settlementNo: slip.settlementNo,
      date: new Date(slip.date).toLocaleDateString("en-IN"),
      customerName: slip.customerName,
      customerPhone: inv.customerPhone || "",
      goldSettledLabel: `${mgToGrams(slip.goldUsedFineMg)} g Fine Gold`,
      goldReceivedLabel: `${mgToGrams(slip.goldReceivedFineMg)} g Fine Gold`,
      cashSettledLabel: isPureGold ? "" : `₹ ${paiseToRupees(slip.cashReceivedPaise)}`,
      goldRateLabel: isPureGold ? "995 Touch Basis" : slip.goldRatePerGramPaise > 0 ? `₹ ${paiseToRupees(slip.goldRatePerGramPaise)}/g` : "Market Live Rate",
      notes: inv.notes || "Customer mutual reconciliation and settlement completed.",
      previousGoldBalance: `${mgToGrams(slip.previousGoldBalanceMg)} g Fine Gold`,
      closingGoldBalance: `${mgToGrams(slip.closingGoldBalanceMg)} g Fine Gold`,
      closingSettlementLabel: isPureGold ? "" : `₹ ${paiseToRupees(slip.closingSettlementPaise)}`,
      settlementStatus: inv.balancePaise === 0 ? "Fully Settled" : "Partial Due",
    },
    tables: {
      items: slip.items.map((it) => ({
        description: it.description,
        purity: purityLabel(it.purity),
        grossWt: `${mgToGrams(it.grossMg)} g`,
        netWt: `${mgToGrams(it.netMg)} g`,
        fineWt: `${mgToGrams(Math.round((it.netMg * it.purity) / 995))} g`,
        pcs: `${it.pcs || 1}`,
      })),
    },
    flags: {
      isPureGold,
      hasCash: !isPureGold && slip.cashReceivedPaise > 0,
      hasCustomerPhone: !!inv.customerPhone,
      hasBalance: isPureGold ? Math.max(0, slip.goldUsedFineMg - slip.goldReceivedFineMg) > 0 : inv.balancePaise > 0,
      hasNotes: !!inv.notes,
    },
    images: {},
    balances: {},
  };
};

const metalConversionSlipBuilder: PrintContextBuilder = (recordId) => {
  const record = useMetalConversion.getState().records.find((r) => r.id === recordId);
  if (!record) return null;
  return {
    docType: "metal_conversion_slip",
    docNumber: record.batchNo,
    recordId: record.id,
    createdAt: record.createdAt ?? Date.now(),
    title: "Metal Conversion Slip",
    fields: {
      settlementNo: record.batchNo,
      date: new Date(record.createdAt ?? Date.now()).toLocaleDateString("en-IN"),
      customerName: `${record.sourcePurity} → ${record.destPurity}`,
      goldSettledLabel: `${mgToGrams(record.inputFineMg)} g source`,
      cashSettledLabel: `${mgToGrams(record.actualOutputFineMg)} g output`,
      goldRateLabel: `Alloy ${mgToGrams(record.alloyAddedMg)} g`,
      notes: record.notes || "",
    },
    tables: {},
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
  gold_receive_slip: jobGoldReceiveSlipBuilder,
  filings_receipt: jobFilingsReceiptBuilder,
  polishing_receipt: dailyMaterialSlipBuilder,
  wastage_return_receipt: dailyMaterialSlipBuilder,
  karigar_custody_statement: buildKarigarCustodyStatementData,
  worker_passbook: buildKarigarCustodyStatementData,
  customer_ledger_statement: buildCustomerLedgerStatementData,
  customer_unpaid_invoices: buildCustomerUnpaidInvoicesData,
  customer_paid_invoices: buildCustomerPaidInvoicesData,

  credit_note: (recordId) => {
    const note = useCreditNotes.getState().notes.find((n) => n.id === recordId);
    if (!note) return null;
    const isPureGold = (note.goldFineMg ?? 0) > 0 && (note.amountPaise ?? 0) === 0;
    return {
      docType: "credit_note",
      docNumber: note.creditNoteNo,
      recordId: note.id,
      createdAt: note.createdAt,
      title: isPureGold ? "Gold Return / Credit Note" : "Credit Note (Sales Return)",
      fields: {
        customerName: note.customerName || "Walk-in Customer",
        invoiceNo: note.invoiceNo || "—",
        amountLabel: isPureGold
          ? `${mgToGrams(note.goldFineMg)} g Fine Gold`
          : note.goldFineMg > 0
            ? `${mgToGrams(note.goldFineMg)} g Fine Gold (₹ ${paiseToRupees(note.amountPaise)})`
            : `₹ ${paiseToRupees(note.amountPaise)}`,
        goldFineLabel: `${mgToGrams(note.goldFineMg || 0)} g Fine Gold`,
        reasonText: note.reason || "Return / Adjustment",
        statusText: note.status === "issued" ? "Issued" : "Cancelled",
      },
      tables: {},
      flags: {
        isIssued: note.status === "issued",
        isCancelled: note.status === "cancelled",
        isPureGold,
        hasCash: !isPureGold,
      },
      images: {},
      balances: {
        gold: {
          previous: 0,
          in: note.goldFineMg || 0,
          out: 0,
          closing: note.goldFineMg || 0,
        },
        cash: {
          previous: 0,
          in: note.amountPaise || 0,
          out: 0,
          closing: note.amountPaise || 0,
        },
      },
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
    if (est) {
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
    }

    const inv = useBilling.getState().invoices.find((i) => i.id === recordId);
    if (inv) {
      const isPureGold =
        inv.transactionMode === "gold" ||
        (inv.transactionMode !== "cash" &&
          (inv.billingType === "job_work" ||
            inv.billingType === "wholesale"));
      const totalFine = inv.items.reduce((s, it) => s + (it.fineMg || 0), 0);

      return {
        docType: "estimate_doc",
        docNumber: inv.invoiceNo,
        recordId: inv.id,
        createdAt: inv.createdAt,
        title: isPureGold ? "Gold Estimate / Quotation (995 Basis)" : "Estimate / Quotation",
        fields: {
          customerName: inv.customerName || "Walk-in Customer",
          customerPhone: inv.customerPhone || "",
          statusText: "Draft",
          subtotalLabel: isPureGold ? `${mgToGrams(totalFine)} g Fine Gold` : `₹ ${paiseToRupees(inv.subtotalPaise)}`,
          gstLabel: isPureGold ? "Included in 995 Basis" : `₹ ${paiseToRupees(inv.gstPaise)}`,
          grandTotalLabel: isPureGold ? `${mgToGrams(totalFine)} g Fine Gold` : `₹ ${paiseToRupees(inv.grandTotalPaise)}`,
          notesText: inv.notes || "",
          validityText:
            "Valid for 15 days from the date of issue. Prices subject to gold rate at time of order confirmation.",
        },
        tables: {
          items: inv.items.map((it) => ({
            itemName: it.itemName,
            fineWt: `${mgToGrams(it.fineMg)}g`,
            amountLabel: isPureGold ? `${mgToGrams(it.fineMg)} g Fine Gold` : `₹ ${paiseToRupees(it.lineTotalPaise)}`,
          })),
        },
        flags: {
          hasCustomerPhone: !!inv.customerPhone,
          hasGst: inv.gstPaise > 0,
          hasNotes: !!inv.notes,
        },
        images: {},
        balances: {},
      };
    }

    return null;
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
    const customer = usePeople.getState().people.find((p) => p.id === c.customerId);
    return {
      docType: "delivery_challan",
      docNumber: c.challanNo,
      recordId: c.id,
      createdAt: c.createdAt,
      title: "Delivery Challan",
      fields: {
        challanNo: c.challanNo,
        challanDate: new Date(c.createdAt).toLocaleDateString("en-IN"),
        customerName: c.customerName || "Walk-in Customer",
        customerPhone: customer?.phone || "",
        customerAddress: c.deliveryAddress || customer?.addressLine1 || customer?.currentAddress || "",
        statusText: CHALLAN_STATUS_LABELS[c.status] ?? c.status,
        notesText: c.notes || "",
        purposeText: `Goods dispatched for ${c.purpose.replace(/_/g, " ")} · Not a Tax Invoice`,
      },
      tables: {
        items: c.items.map((it) => ({
          itemName: it.itemName,
          qty: it.qty,
          grossWt: `${mgToGrams(it.grossMg)} g`,
          netWt: `${mgToGrams(it.netMg)} g`,
          purity: String(it.purity),
          fineWt: `${mgToGrams(it.fineMg)} g`,
        })),
      },
      flags: {
        hasCustomerPhone: !!customer?.phone,
        hasCustomerAddress: !!(c.deliveryAddress || customer?.addressLine1 || customer?.currentAddress),
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
    const inv = useBilling.getState().invoices.find((i) => i.id === recordId);
    if (inv) {
      const isPureGold =
        inv.transactionMode === "gold" ||
        (inv.transactionMode !== "cash" &&
          (inv.billingType === "job_work" ||
            inv.billingType === "wholesale" ||
            (inv.paidPaise === 0 && inv.payments.every((p) => (p.goldFineMg ?? 0) > 0))));

      const totalPaidPaise = inv.payments.reduce((s, p) => s + (p.amountPaise || 0), 0);
      const totalPaidGoldMg = inv.payments.reduce((s, p) => s + (p.goldFineMg || 0), 0);
      const totalFineObligationMg = inv.items.reduce((s, it) => s + (it.fineMg || 0), 0);
      const balanceGoldMg = Math.max(0, totalFineObligationMg - totalPaidGoldMg);

      return {
        docType: "payment_receipt",
        docNumber: `RCP-${inv.invoiceNo}`,
        recordId: inv.id,
        createdAt: inv.createdAt,
        title: isPureGold ? "Gold Payment Receipt" : "Payment Receipt",
        fields: {
          receiptNo: `RCP-${inv.invoiceNo}`,
          invoiceNo: inv.invoiceNo,
          customerName: inv.customerName || "Walk-in Customer",
          customerPhone: inv.customerPhone || "",
          totalReceived: isPureGold
            ? `${mgToGrams(totalPaidGoldMg)} g Fine Gold`
            : totalPaidGoldMg > 0
              ? `${mgToGrams(totalPaidGoldMg)} g Gold + ₹ ${paiseToRupees(totalPaidPaise)}`
              : `₹ ${paiseToRupees(totalPaidPaise)}`,
          amountLabel: isPureGold
            ? `${mgToGrams(totalPaidGoldMg)} g Fine Gold`
            : `₹ ${paiseToRupees(totalPaidPaise || inv.grandTotalPaise)}`,
          invoiceBalance: isPureGold
            ? `${mgToGrams(balanceGoldMg)} g Fine Gold`
            : `₹ ${paiseToRupees(inv.balancePaise)}`,
          amountInWordsText: isPureGold
            ? `${mgToGrams(totalPaidGoldMg)} Grams Fine Gold Only`
            : `Rupees ${paiseToRupees(totalPaidPaise || inv.grandTotalPaise)} Only`,
          dateLabel: new Date(inv.createdAt).toLocaleString("en-IN"),
        },
        tables: {
          payments: inv.payments.map((p) => {
            const isGold = p.mode === "gold_exchange" || p.mode === "customer_gold_credit" || (p.goldFineMg ?? 0) > 0;
            return {
              date: new Date(p.ts).toLocaleDateString("en-IN"),
              mode: p.mode ? p.mode.toUpperCase() : "CASH",
              reference: p.reference || "—",
              amount: isGold
                ? `${mgToGrams(p.goldFineMg || 0)} g fine (${p.goldGrossMg ? `${mgToGrams(p.goldGrossMg)}g gross` : "fine"})`
                : `₹ ${paiseToRupees(p.amountPaise)}`,
            };
          }),
          entries: inv.payments.map((p) => {
            const isGold = p.mode === "gold_exchange" || p.mode === "customer_gold_credit" || (p.goldFineMg ?? 0) > 0;
            return {
              particulars: `Payment received against ${inv.invoiceNo} (${p.mode ? p.mode.toUpperCase() : "CASH"})`,
              date: new Date(p.ts).toLocaleDateString("en-IN"),
              amount: isGold
                ? `${mgToGrams(p.goldFineMg || 0)} g Fine Gold`
                : `₹ ${paiseToRupees(p.amountPaise)}`,
            };
          }),
        },
        flags: {
          hasCustomerPhone: !!inv.customerPhone,
          isPaid: isPureGold ? balanceGoldMg <= 0 : inv.balancePaise <= 0,
          isPureGold,
          hasCash: !isPureGold,
        },
        images: {},
        balances: {
          cash: {
            previous: 0,
            in: isPureGold ? 0 : totalPaidPaise,
            out: 0,
            closing: isPureGold ? 0 : inv.balancePaise,
          },
          gold: {
            previous: 0,
            in: totalPaidGoldMg,
            out: 0,
            closing: balanceGoldMg,
          },
        },
      };
    }

    const order = useOrders.getState().orders.find((o) => o.id === recordId);
    if (order) {
      return builders.advance_receipt(recordId);
    }

    return null;
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
    if (settlement) {
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
    }

    const inv = useBilling.getState().invoices.find((i) => i.id === recordId);
    if (inv) {
      return customerSettlementSlipBuilder(recordId);
    }

    return null;
  },

  settlement_draft: (recordId) => {
    const s = builders.gold_settlement(recordId);
    if (s) {
      return {
        ...s,
        docType: "settlement_draft",
        title: "Customer Settlement Draft (Preview)",
      };
    }
    const inv = useBilling.getState().invoices.find((i) => i.id === recordId);
    if (inv) {
      return customerSettlementSlipBuilder(recordId);
    }
    return null;
  },

  home_settlement_slip: customerSettlementSlipBuilder,

  jewellery_tag: (recordId) => {
    const item = useStock.getState().items.find((i) => i.id === recordId);
    const mfg = !item ? useManufacturingBarcodes.getState().barcodes.find((b) => b.id === recordId) : null;
    const rows = item
      ? [
          {
            barcode: item.barcode,
            itemCode: item.itemCode,
            itemName: item.itemName,
            purity: item.purity,
            grossMg: item.grossMg,
            netMg: item.netMg,
            huid: item.huid || "—",
          },
        ]
      : mfg
        ? [
            {
              barcode: mfg.barcodeNumber,
              itemCode: mfg.tagNumber || mfg.barcodeNumber,
              itemName: mfg.productDescription || "Jewellery Item",
              purity: mfg.purity,
              grossMg: mfg.grossMg,
              netMg: mfg.netMg,
              huid: mfg.huid || "—",
            },
          ]
        : useStock.getState().items.slice(0, 10).map((it) => ({
            barcode: it.barcode,
            itemCode: it.itemCode,
            itemName: it.itemName,
            purity: it.purity,
            grossMg: it.grossMg,
            netMg: it.netMg,
            huid: it.huid || "—",
          }));

    return {
      docType: "jewellery_tag",
      docNumber: item?.itemCode || mfg?.tagNumber || mfg?.barcodeNumber || "TAGS",
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
    const addr =
      worker?.currentAddress ||
      [worker?.addressLine1, worker?.villageCity, worker?.state].filter(Boolean).join(", ") ||
      "—";
    const phone = worker?.phone || worker?.whatsapp || "";
    const skill = worker?.type || worker?.roles?.[0] || "";
    return {
      docType: "worker_kyc",
      docNumber: `KYC-${worker?.id.slice(0, 8) || "001"}`,
      recordId,
      createdAt: worker?.createdAt ?? Date.now(),
      title: "Artisan Verification & KYC Sheet",
      fields: {
        workerName: worker?.fullName || "Artisan",
        workerPhone: phone || "—",
        workerSkill: skill || "Goldsmith",
        idNumber: worker?.aadhaar
          ? `XXXX-XXXX-${String(worker.aadhaar).replace(/\D/g, "").slice(-4)}`
          : worker?.pan || "—",
        panNumber: worker?.pan || "—",
        gstin: worker?.gstin || "—",
        emergencyContact: worker?.altPhone || "—",
        nativePlace: addr,
        joiningDate: worker?.createdAt
          ? new Date(worker.createdAt).toLocaleDateString("en-IN")
          : "—",
        bankAccount: worker?.bankAccountNumber ? "On file" : "—",
        kycStatus: worker?.kycProgress || (worker ? "Pending verification" : "Unknown"),
      },
      tables: {},
      flags: {
        hasWorkerRecord: !!worker,
        hasWorkerPhone: !!phone,
        hasWorkerSkill: !!skill,
        hasKycImages: false,
      },
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

  metal_conversion_slip: metalConversionSlipBuilder,

  platform_tax_invoice: (recordId) => {
    const entry = usePlatformPrintStore.getState().get(recordId);
    if (!entry) return null;
    const { doc, buyerName, buyerAddress, buyerGstin, branding } = entry;
    const rs = (minor: number | null | undefined) =>
      `₹${((minor ?? 0) / 100).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    const DOC_LABEL: Record<string, string> = {
      quotation: "Quotation",
      proforma: "Proforma Invoice",
      tax_invoice: "Tax Invoice",
      renewal_invoice: "Renewal Invoice",
      credit_note: "Credit Note",
      payment_receipt: "Payment Receipt",
    };
    const title = DOC_LABEL[doc.document_type] ?? "Platform Invoice";
    const issuedMs = doc.issued_at ? Date.parse(doc.issued_at) : Date.now();
    return {
      docType: "platform_tax_invoice",
      docNumber: doc.document_no,
      recordId: doc.id,
      createdAt: Number.isFinite(issuedMs) ? issuedMs : Date.now(),
      title,
      fields: {
        sellerName: branding.companyName || branding.legalName || "AVS ERP platform",
        sellerAddress: branding.address || "—",
        sellerGstin: branding.gstin || "—",
        sellerEmail: branding.email || "—",
        sellerPhone: branding.phone || "—",
        buyerName,
        buyerAddress: buyerAddress || "—",
        buyerGstin: buyerGstin || "—",
        documentNo: doc.document_no,
        documentType: title,
        statusText: doc.status,
        issuedAt: doc.issued_at
          ? new Date(doc.issued_at).toLocaleDateString("en-IN")
          : "—",
        dueAt: doc.due_at ? new Date(doc.due_at).toLocaleDateString("en-IN") : "—",
        taxableLabel: rs(doc.taxable_minor),
        cgstLabel: rs(doc.cgst_minor),
        sgstLabel: rs(doc.sgst_minor),
        igstLabel: rs(doc.igst_minor),
        gstLabel: rs(doc.gst_minor),
        totalLabel: rs(doc.amount_minor),
        paidLabel: rs(doc.paid_minor),
        descriptionText: doc.data?.description || "Platform commercial charges",
        gstRateText:
          doc.data?.gst_rate_percent != null ? `${doc.data.gst_rate_percent}%` : "—",
      },
      tables: {
        lines: [
          {
            description: doc.data?.description || "Platform commercial charges",
            hsn: "9983",
            taxable: rs(doc.taxable_minor),
            tax: rs(doc.gst_minor),
            total: rs(doc.amount_minor),
          },
        ],
      },
      flags: {
        hasIgst: (doc.igst_minor ?? 0) > 0,
        isPaid:
          (doc.paid_minor ?? 0) >= (doc.amount_minor ?? 0) && (doc.amount_minor ?? 0) > 0,
      },
      images: {},
      balances: {},
    };
  },


  account_balance_report: buildAccountBalanceReportData,
  cash_book: buildCashBookPrintData,
  fine_rojmel: buildFineRojmelPrintData,
  dar_rojmel: buildDarRojmelPrintData,
  karigar_book: buildKarigarBookPrintData,
  barcode_stock: buildBarcodeStockPrintData,
  item_jama_nave: buildItemJamaNavePrintData,
  dhadi_book: buildDhadiBookPrintData,
  daily_jewellery_summary: buildDailyJewellerySummaryPrintData,
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
