/**
 * Unified Print Engine — GST/Retail Invoice data builder.
 *
 * Ports billing.print.$id.tsx's `getItemPhoto` (4-tier attachment lookup)
 * and `rupeesToWords` (Indian crore/lakh/thousand converter) verbatim —
 * this is the one live call site for both today, confirmed by grep
 * (a second, unrelated copy of rupeesToWords already existed in the dead
 * src/modules/billing/components/InvoicePrintTemplate.tsx, removed
 * alongside this migration). Deliberately its own file, not folded into
 * data-mapper.ts, given the size — same reasoning as job-card-engine.ts
 * being its own file for job cards.
 */
import { useAttachments } from "@/lib/attachments-store";
import type { Invoice, InvoiceItem } from "@/lib/billing-store";
import { PAYMENT_MODE_LABELS, paiseToRupees } from "@/lib/billing-store";
import { jewelleryPaymentStatus, JEWELLERY_PAYMENT_STATUS_LABELS } from "@/lib/invoice-payment-status";
import { compileCustomerLedger } from "@/lib/customer-account-ledger";
import { mgToGrams } from "@/lib/gold";
import { lineReferenceDocKey } from "@/lib/job-card-engine";
import { useCatalog } from "@/lib/catalog-store";
import { orderItems, useOrders } from "@/lib/orders-store";
import { isStockProductPhotoKey } from "@/lib/stock-photos";
import { useStock } from "@/lib/stock-store";
import { useSettings } from "@/lib/settings-store";
import type { PrintDocumentData } from "./types";

function inlineAttachmentUrl(key: string): string | null {
  const rec = useAttachments.getState().items[key];
  if (!rec) return null;
  return rec.thumbnailDataUrl || rec.fileDataUrl || null;
}

function orderLineIdForInvoiceItem(orderId: string, it: InvoiceItem): string | undefined {
  const order = useOrders.getState().orders.find((o) => o.id === orderId);
  if (!order) return undefined;
  const lines = orderItems(order);
  if (lines.length === 0) return undefined;
  const byName = lines.find((line) => line.itemName === it.itemName);
  if (byName?.lineId) return byName.lineId;
  if (lines.length === 1) return lines[0]?.lineId;
  return undefined;
}

function getItemPhoto(it: InvoiceItem, orderId?: string): string | null {
  const attachments = useAttachments.getState().items;

  if (it.stockItemId) {
    const stockList = useAttachments.getState().listForEntity("stock", it.stockItemId);
    for (const { docKey } of stockList) {
      if (isStockProductPhotoKey(docKey)) {
        const url = inlineAttachmentUrl(`stock:${it.stockItemId}:${docKey}`);
        if (url) return url;
      }
    }
    for (const legacy of ["design_photo", "item_photo"] as const) {
      const url = inlineAttachmentUrl(`stock:${it.stockItemId}:${legacy}`);
      if (url) return url;
    }
  }

  if (it.stockItemId || it.barcode) {
    const stockItem = useStock
      .getState()
      .items.find((s) => s.id === it.stockItemId || (it.barcode && s.barcode === it.barcode));
    if (stockItem) {
      const stockList = useAttachments.getState().listForEntity("stock", stockItem.id);
      for (const { docKey } of stockList) {
        if (isStockProductPhotoKey(docKey)) {
          const url = inlineAttachmentUrl(`stock:${stockItem.id}:${docKey}`);
          if (url) return url;
        }
      }
      const stockKey = `stock:${stockItem.id}:design_photo`;
      if (attachments[stockKey]?.thumbnailDataUrl || attachments[stockKey]?.fileDataUrl) {
        return attachments[stockKey].thumbnailDataUrl || attachments[stockKey].fileDataUrl || null;
      }
      const catalogDesign = useCatalog
        .getState()
        .designs.find(
          (d) => d.designNumber === stockItem.itemCode || d.designName === stockItem.itemName,
        );
      if (catalogDesign) {
        const catKey = `catalog:${catalogDesign.id}:design_photo`;
        if (attachments[catKey]?.thumbnailDataUrl || attachments[catKey]?.fileDataUrl) {
          return attachments[catKey].thumbnailDataUrl || attachments[catKey].fileDataUrl || null;
        }
      }
    }
  }

  const catalogByName = useCatalog.getState().designs.find((d) => d.designName === it.itemName);
  if (catalogByName) {
    const catKey = `catalog:${catalogByName.id}:design_photo`;
    if (attachments[catKey]?.thumbnailDataUrl || attachments[catKey]?.fileDataUrl) {
      return attachments[catKey].thumbnailDataUrl || attachments[catKey].fileDataUrl || null;
    }
  }

  if (orderId) {
    const lineId = orderLineIdForInvoiceItem(orderId, it);
    if (lineId) {
      const lineKey = `order:${orderId}:${lineReferenceDocKey(lineId)}`;
      const lineUrl = inlineAttachmentUrl(lineKey);
      if (lineUrl) return lineUrl;
    }
    const orderKey = `order:${orderId}:design_photo`;
    if (attachments[orderKey]?.thumbnailDataUrl || attachments[orderKey]?.fileDataUrl) {
      return attachments[orderKey].thumbnailDataUrl || attachments[orderKey].fileDataUrl || null;
    }
  }

  return null;
}

function rupeesToWords(totalPaise: number): string {
  const totalRupees = Math.floor(totalPaise / 100);
  if (totalRupees === 0) return "Zero Rupees Only";

  const arr1 = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const arr2 = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function convertLessThanOneThousand(n: number): string {
    if (n === 0) return "";
    let str = "";
    if (n >= 100) {
      str += arr1[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n >= 20) {
      str += arr2[Math.floor(n / 10)] + " ";
      n %= 10;
    }
    if (n > 0) str += arr1[n] + " ";
    return str.trim();
  }

  let temp = totalRupees;
  let words = "";
  if (Math.floor(temp / 10000000) > 0) {
    words += convertLessThanOneThousand(Math.floor(temp / 10000000)) + " Crore ";
    temp %= 10000000;
  }
  if (Math.floor(temp / 100000) > 0) {
    words += convertLessThanOneThousand(Math.floor(temp / 100000)) + " Lakh ";
    temp %= 100000;
  }
  if (Math.floor(temp / 1000) > 0) {
    words += convertLessThanOneThousand(Math.floor(temp / 1000)) + " Thousand ";
    temp %= 1000;
  }
  if (temp > 0) words += convertLessThanOneThousand(temp);

  return (words.trim() + " Rupees Only").replace(/\s+/g, " ");
}

const rupees = (paise: number) => `₹${paiseToRupees(paise)}`;

function itemDescription(it: InvoiceItem): string {
  const lines = [it.itemName];
  if (it.barcode) lines.push(`Tag: ${it.barcode}`);
  if (it.huid) lines.push(`HUID: ${it.huid}`);
  if (it.stoneWeightMg && it.stoneWeightMg > 0)
    lines.push(`Stone Wt: ${mgToGrams(it.stoneWeightMg)} g`);
  if (it.diamondWeightMg && it.diamondWeightMg > 0)
    lines.push(`Diamond Wt: ${(it.diamondWeightMg / 200).toFixed(2)} ct`);
  return lines.join("\n");
}

export function buildInvoicePrintData(inv: Invoice): PrintDocumentData {
  const docType = inv.gst === "gst3" ? "gst_invoice" : "retail_invoice";
  const badgeTitle = inv.gst === "gst3" ? "Tax Invoice (3% GST)" : "Retail Cash Memo";

  const totalGrossMg = inv.items.reduce((a, it) => a + (it.grossMg || 0), 0);
  const totalNetMg = inv.items.reduce((a, it) => a + (it.netMg || 0), 0);
  const totalFineMg = inv.items.reduce((a, it) => a + (it.fineMg || 0), 0);
  const totalGoldValuePaise = inv.items.reduce((a, it) => a + (it.goldValuePaise || 0), 0);
  const totalMakingChargesPaise = inv.items.reduce((a, it) => a + (it.makingChargesPaise || 0), 0);
  const totalStoneChargesPaise = inv.items.reduce((a, it) => a + (it.stoneChargesPaise || 0), 0);
  const totalHallmarkChargesPaise = inv.items.reduce(
    (a, it) => a + (it.hallmarkChargesPaise || 0),
    0,
  );
  const totalOtherChargesPaise = inv.items.reduce((a, it) => a + (it.otherChargesPaise || 0), 0);
  const totalDiscountPaise = inv.items.reduce((a, it) => a + (it.discountPaise || 0), 0);
  const totalLineTotalPaise = inv.items.reduce((a, it) => a + (it.lineTotalPaise || 0), 0);
  const hasHallmarkCharges = totalHallmarkChargesPaise > 0;
  const hasOtherCharges = totalOtherChargesPaise > 0;
  const hasCgstSgst = inv.cgstPaise > 0 && inv.sgstPaise > 0;
  const isGst3 = inv.gst === "gst3";

  const items = inv.items.map((it) => {
    const tanchPct = it.purity ? it.purity / 10 : 0;
    const wstgPct = it.wastagePct != null ? Number(it.wastagePct) : 0;
    const hisobPct =
      it.hisobPct != null && Number.isFinite(Number(it.hisobPct))
        ? Number(it.hisobPct)
        : Math.round((tanchPct + wstgPct) * 100) / 100;
    return {
    photoUrl: getItemPhoto(it, inv.orderId) ?? "",
    jnLabel: it.jn === 1 ? "Jama" : it.jn === 2 ? "Nave" : "",
    tanch: it.purity ? tanchPct.toFixed(2) : "",
    wstg: it.wastagePct != null ? wstgPct.toFixed(2) : "",
    hisob: hisobPct > 0 ? hisobPct.toFixed(2) : "",
    lessWt: it.lessMg ? `${mgToGrams(it.lessMg)}` : "",
    addWt: (() => {
      const add = it.addMg ?? it.stoneWeightMg ?? 0;
      return add > 0 ? `${mgToGrams(add)}` : "";
    })(),
    pcs: it.pcs != null ? String(it.pcs) : "",
    description: itemDescription(it),
    purity: String(it.purity),
    grossWt: `${mgToGrams(it.grossMg)}`,
    netWt: `${mgToGrams(it.netMg)}`,
    fineWt: `${mgToGrams(it.fineMg)}`,
    rateLabel: rupees(it.goldRatePerGramPaise),
    goldValueLabel: rupees(it.goldValuePaise),
    makingLabel: rupees(it.makingChargesPaise),
    stoneLabel: rupees(it.stoneChargesPaise),
    hallmarkLabel: rupees(it.hallmarkChargesPaise || 0),
    otherLabel: rupees(it.otherChargesPaise),
    discountLabel: `-${rupees(it.discountPaise)}`,
    totalLabel: rupees(it.lineTotalPaise),
    // thermal-only fields
    itemNameShort: (it.itemName || "").slice(0, 22),
    weightSummary: `GW: ${mgToGrams(it.grossMg)}g | NW: ${mgToGrams(it.netMg)}g | ${it.purity}`,
    huid: it.huid || "—",
    stoneSummary: [
      it.stoneWeightMg ? `Stone: ${mgToGrams(it.stoneWeightMg)}g` : "",
      it.diamondWeightMg ? `Diamond: ${(it.diamondWeightMg / 200).toFixed(2)}ct` : "",
    ]
      .filter(Boolean)
      .join(" "),
    // tag-only field
    barcode: it.barcode || "",
    hsnCode: it.hsnCode || "",
    metalKind: it.metalKind === "silver" ? "Silver" : it.metalKind === "gold" ? "Gold" : "",
  };
  });

  const itemsTotals = [
    {
      description: "Totals",
      jnLabel: "",
      tanch: "",
      wstg: "",
      hisob: "",
      lessWt: "",
      addWt: "",
      pcs: "",
      purity: "",
      grossWt: `${mgToGrams(totalGrossMg)}`,
      netWt: `${mgToGrams(totalNetMg)}`,
      fineWt: `${mgToGrams(totalFineMg)}`,
      rateLabel: "—",
      goldValueLabel: rupees(totalGoldValuePaise),
      makingLabel: rupees(totalMakingChargesPaise),
      stoneLabel: rupees(totalStoneChargesPaise),
      hallmarkLabel: rupees(totalHallmarkChargesPaise),
      otherLabel: rupees(totalOtherChargesPaise),
      discountLabel: `-${rupees(totalDiscountPaise)}`,
      totalLabel: rupees(totalLineTotalPaise),
      huid: "",
      barcode: "",
      hsnCode: "",
      metalKind: "",
    },
  ];

  const fallbackRatePaise =
    inv.items[0]?.goldRatePerGramPaise ||
    (Array.isArray(inv.payments) ? inv.payments : []).find((p) => (p.goldRatePerGramPaise ?? 0) > 0)?.goldRatePerGramPaise ||
    750000;

  const payments = (Array.isArray(inv.payments) ? inv.payments : []).map((p) => {
    const isGoldPayment = p.mode === "gold_exchange" || p.mode === "customer_gold_credit";
    const goldFine = p.goldFineMg ?? (p.goldGrossMg ? Math.round((p.goldGrossMg * (p.goldPurity || 916)) / 995) : 0);

    if (isGoldPayment && goldFine > 0) {
      return {
        modeLabel: PAYMENT_MODE_LABELS[p.mode] || "Gold Handed Over",
        reference: p.reference
          ? `${p.reference} (${mgToGrams(goldFine)}g Fine Gold @ ${p.goldPurity || 916} Touch)`
          : `Physical Metal Receipt: ${mgToGrams(p.goldGrossMg || goldFine)}g Gross → ${mgToGrams(goldFine)}g Fine Gold (${p.goldPurity || 916} Touch)`,
        amountLabel: `${mgToGrams(goldFine)} g Fine Gold`,
      };
    }

    const rateP = p.goldRatePerGramPaise || fallbackRatePaise;
    const equivMg = rateP > 0 ? Math.round((p.amountPaise * 1000) / rateP) : 0;
    const rateNote = rateP > 0 ? `Rate: ₹${paiseToRupees(rateP)}/g` : "";
    const equivNote = equivMg > 0 ? `Gold Equiv: ${mgToGrams(equivMg)}g Fine` : "";
    const metaNotes = [rateNote, equivNote].filter(Boolean).join(" | ");

    return {
      modeLabel: PAYMENT_MODE_LABELS[p.mode] || p.mode,
      reference: p.reference
        ? `${p.reference}${metaNotes ? ` (${metaNotes})` : ""}`
        : metaNotes
          ? `Settled in Cash (${metaNotes})`
          : "Cash Settlement",
      amountLabel: rupees(p.amountPaise),
    };
  });

  const ticketInfo = [
    { label: "Voucher", value: inv.invoiceNo },
    { label: "Date", value: new Date(inv.createdAt).toLocaleDateString("en-IN") },
    { label: "Cust Name", value: inv.customerName },
    ...(inv.customerPhone ? [{ label: "Phone", value: inv.customerPhone }] : []),
  ];

  const isPureGoldInvoice =
    (inv.payments || []).length > 0 &&
    (inv.payments || []).every(
      (p) => p.mode === "gold_exchange" || p.mode === "customer_gold_credit",
    );
  const totalPaidGoldMg = (inv.payments || []).reduce((sum, p) => sum + (p.goldFineMg || 0), 0);
  const remainingGoldDueMg = Math.max(0, totalFineMg - totalPaidGoldMg);

  const thermalTotals = [
    { label: "Gross Metal Value", value: rupees(totalGoldValuePaise) },
    { label: "Total Fine Gold", value: `${mgToGrams(totalFineMg)} g Fine` },
    { label: "Labour / Making", value: rupees(totalMakingChargesPaise) },
    ...(totalStoneChargesPaise > 0
      ? [{ label: "Stone Valuation", value: rupees(totalStoneChargesPaise) }]
      : []),
    ...(totalOtherChargesPaise > 0
      ? [{ label: "Other Charges", value: rupees(totalOtherChargesPaise) }]
      : []),
    ...(isGst3
      ? [{ label: "GST Allocation (3%)", value: rupees(inv.cgstPaise + inv.sgstPaise) }]
      : []),
    ...(totalDiscountPaise > 0
      ? [{ label: "Discount Reduction", value: `-${rupees(totalDiscountPaise)}` }]
      : []),
    ...(isPureGoldInvoice
      ? [
          { label: "GRAND TOTAL (GOLD)", value: `${mgToGrams(totalFineMg)} g Fine` },
          { label: "Total Paid (Gold)", value: `${mgToGrams(totalPaidGoldMg)} g Fine` },
          { label: "OUTSTANDING DUE (GOLD)", value: `${mgToGrams(remainingGoldDueMg)} g Fine` },
        ]
      : [
          { label: "GRAND TOTAL", value: rupees(inv.grandTotalPaise) },
          { label: "Amount Paid", value: rupees(inv.paidPaise) },
          { label: "OUTSTANDING DUE", value: rupees(inv.balancePaise) },
        ]),
  ];

  return {
    docType,
    docNumber: inv.invoiceNo,
    recordId: inv.id,
    createdAt: inv.createdAt,
    title: isGst3 ? "Tax Invoice (GST 3%)" : "Retail Invoice",
    fields: {
      badgeTitle,
      invoiceNo: inv.invoiceNo,
      invoiceDate: new Date(inv.createdAt).toLocaleDateString("en-IN"),
      customerName: inv.customerName,
      customerPhone: inv.customerPhone || "",
      customerGstin: inv.customerGstin || "",
      orderNo: inv.orderNo || "",
      jobNo: inv.jobNo || "",
      ownerName: "Authorised Signatory",
      amountInWordsText: rupeesToWords(inv.grandTotalPaise),
      goldValueLabel: rupees(totalGoldValuePaise),
      makingLabel: rupees(totalMakingChargesPaise),
      stoneLabel: rupees(totalStoneChargesPaise),
      discountLabel: `-${rupees(totalDiscountPaise)}`,
      subtotalLabel: rupees(inv.subtotalPaise),
      cgstLabel: rupees(inv.cgstPaise),
      sgstLabel: rupees(inv.sgstPaise),
      igstLabel: rupees(inv.cgstPaise + inv.sgstPaise),
      gstExemptText: "Composition Exempt",
      adjustmentLabel: `-${rupees(inv.adjustmentPaise)}`,
      grandTotalLabel: rupees(inv.grandTotalPaise),
      paidLabel: rupees(inv.paidPaise),
      balanceLabel: rupees(inv.balancePaise),
      narration: inv.notes || "",
      haste: inv.haste || "",
      salesman: inv.salesman || "",
      dayRateLabel: inv.items[0]?.goldRatePerGramPaise
        ? rupees(inv.items[0].goldRatePerGramPaise)
        : "",
      paymentStatusLabel: JEWELLERY_PAYMENT_STATUS_LABELS[jewelleryPaymentStatus(inv)],
      dueDate: inv.dueAt ? new Date(inv.dueAt).toLocaleDateString("en-IN") : "",
      gstSummaryLabel: isGst3
        ? hasCgstSgst
          ? `CGST ${rupees(inv.cgstPaise)} + SGST ${rupees(inv.sgstPaise)}`
          : `GST ${rupees(inv.cgstPaise + inv.sgstPaise)}`
        : "",
      cashAdvanceLabel: inv.orderAdjustment
        ? `-${rupees(inv.orderAdjustment.cashAdvancePaise)}`
        : "",
      oldGoldLabel: inv.orderAdjustment
        ? `-${rupees(inv.orderAdjustment.goldValuePaise)} (${mgToGrams(inv.orderAdjustment.goldGrossMg)}g)`
        : "",
      tcsLabel: inv.tcsPaise > 0 ? rupees(inv.tcsPaise) : "",
      placeOfSupply: inv.placeOfSupply || "",
      paymentModeLabel: (Array.isArray(inv.payments) ? inv.payments : []).length
        ? (Array.isArray(inv.payments) ? inv.payments : [])
            .map((p) => PAYMENT_MODE_LABELS[p.mode] ?? p.mode)
            .join(", ")
        : "",
      roundOffLabel:
        inv.roundOffPaise != null && inv.roundOffPaise !== 0
          ? rupees(inv.roundOffPaise)
          : "",
      openingFineLabel: inv.partyPrintSnapshot
        ? `${mgToGrams(inv.partyPrintSnapshot.openingFineMg)} g`
        : "",
      closingFineLabel: inv.partyPrintSnapshot
        ? `${mgToGrams(inv.partyPrintSnapshot.closingFineMg)} g`
        : "",
      openingCashLabel: inv.partyPrintSnapshot
        ? rupees(inv.partyPrintSnapshot.openingCashPaise)
        : "",
      closingCashLabel: inv.partyPrintSnapshot
        ? rupees(inv.partyPrintSnapshot.closingCashPaise)
        : "",
      anamatLabel:
        inv.partyPrintSnapshot?.anamatPaise != null && inv.partyPrintSnapshot.anamatPaise > 0
          ? rupees(inv.partyPrintSnapshot.anamatPaise)
          : "",
      bankName: (() => {
        const firm = useSettings.getState().firm;
        return firm?.bankDetails?.bankName || "";
      })(),
      bankAccountNo: (() => {
        const firm = useSettings.getState().firm;
        return firm?.bankDetails?.accountNo || "";
      })(),
      bankIfsc: (() => {
        const firm = useSettings.getState().firm;
        return firm?.bankDetails?.ifsc || "";
      })(),
      verificationPublicToken: inv.verificationPublicToken ?? "",
      partyLabel: inv.customerName || "",
      totalPaise: inv.grandTotalPaise,
    },
    tables: { items, itemsTotals, payments, ticketInfo, thermalTotals },
    flags: {
      hasCustomerPhone: !!inv.customerPhone,
      hasCustomerGstin: !!inv.customerGstin,
      hasOrderNo: !!inv.orderNo,
      hasJobNo: !!inv.jobNo,
      hasHallmarkCharges,
      hasOtherCharges,
      hasStoneCharges: totalStoneChargesPaise > 0,
      hasDiscount: totalDiscountPaise > 0,
      hasPayments: inv.payments.length > 0,
      hasOrderAdjustment: !!inv.orderAdjustment,
      hasOrderAdjustmentCash: !!inv.orderAdjustment && inv.orderAdjustment.cashAdvancePaise > 0,
      hasOrderAdjustmentGold: !!inv.orderAdjustment && inv.orderAdjustment.goldValuePaise > 0,
      hasCgstSgst,
      hasIgstOnly: isGst3 && !hasCgstSgst,
      hasGst: isGst3 && (inv.cgstPaise > 0 || inv.sgstPaise > 0),
      isNotGst3: !isGst3,
      hasAdjustment: inv.adjustmentPaise > 0,
      hasNarration: !!inv.notes,
      hasDueDate: !!inv.dueAt,
      hasHaste: !!inv.haste,
      hasSalesman: !!inv.salesman,
      hasBalance: inv.balancePaise > 0,
      hasHuid: inv.items.some((it) => !!it.huid),
      hasPcs: inv.items.some((it) => (it.pcs ?? 0) > 0),
      hasWastage: inv.items.some((it) => (it.wastagePct ?? 0) > 0),
      hasAddWt: inv.items.some((it) => (it.addMg ?? it.stoneWeightMg ?? 0) > 0),
      hasBarcode: inv.items.some((it) => !!it.barcode),
      hasHsn: inv.items.some((it) => !!it.hsnCode),
      hasTcs: (inv.tcsPaise ?? 0) > 0,
      hasPlaceOfSupply: !!inv.placeOfSupply,
      hasRoundOff: !!(inv.roundOffPaise && inv.roundOffPaise !== 0),
      hasPartyPrintSnapshot: !!inv.partyPrintSnapshot,
      hasPaymentModeLabel: inv.payments.length > 0,
      hasBankDetails: !!useSettings.getState().firm?.bankDetails?.bankName,
      hasJn: inv.items.some((it) => it.jn === 1 || it.jn === 2),
      hasMetalKind: inv.items.some((it) => it.metalKind === "gold" || it.metalKind === "silver"),
      hasItemPhotos: inv.items.some((it) => !!getItemPhoto(it, inv.orderId)),
      isManufacturingBill: inv.billingType === "manufacturing",
      hasVerificationQr: !!inv.verificationPublicToken,
    },
    images: {},
    balances: (() => {
      const party = compileCustomerLedger(inv.customerId);
      return {
        gold: {
          previous: party.openingGoldMg,
          in: party.totalGoldInMg,
          out: party.totalGoldOutMg,
          closing: party.closingGoldMg,
        },
        cash: {
          previous: party.openingMoneyPaise,
          in: party.totalDebitPaise,
          out: party.totalCreditPaise,
          closing: party.closingMoneyPaise,
        },
      };
    })(),
  };
}
