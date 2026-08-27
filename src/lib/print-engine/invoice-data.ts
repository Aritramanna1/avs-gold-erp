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
import { mgToGrams } from "@/lib/gold";
import { useCatalog } from "@/lib/catalog-store";
import { useStock } from "@/lib/stock-store";
import { useSettings } from "@/lib/settings-store";
import type { PrintDocumentData } from "./types";

function getItemPhoto(it: InvoiceItem, orderId?: string): string | null {
  const attachments = useAttachments.getState().items;

  if (it.stockItemId) {
    const key = `stock:${it.stockItemId}:design_photo`;
    if (attachments[key]?.thumbnailDataUrl || attachments[key]?.fileDataUrl) {
      return attachments[key].thumbnailDataUrl || attachments[key].fileDataUrl || null;
    }
  }

  if (it.stockItemId || it.barcode) {
    const stockItem = useStock
      .getState()
      .items.find((s) => s.id === it.stockItemId || (it.barcode && s.barcode === it.barcode));
    if (stockItem) {
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

  const items = inv.items.map((it) => ({
    photoUrl: getItemPhoto(it, inv.orderId) ?? "",
    description: itemDescription(it),
    purity: String(it.purity),
    grossWt: `${mgToGrams(it.grossMg)}g`,
    netWt: `${mgToGrams(it.netMg)}g`,
    fineWt: `${mgToGrams(it.fineMg)}g`,
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
  }));

  const itemsTotals = [
    {
      description: "Totals",
      purity: "",
      grossWt: `${mgToGrams(totalGrossMg)}g`,
      netWt: `${mgToGrams(totalNetMg)}g`,
      fineWt: `${mgToGrams(totalFineMg)}g`,
      rateLabel: "—",
      goldValueLabel: rupees(totalGoldValuePaise),
      makingLabel: rupees(totalMakingChargesPaise),
      stoneLabel: rupees(totalStoneChargesPaise),
      hallmarkLabel: rupees(totalHallmarkChargesPaise),
      otherLabel: rupees(totalOtherChargesPaise),
      discountLabel: `-${rupees(totalDiscountPaise)}`,
      totalLabel: rupees(totalLineTotalPaise),
    },
  ];

  const payments = inv.payments.map((p) => ({
    modeLabel: PAYMENT_MODE_LABELS[p.mode],
    reference: p.reference || "",
    amountLabel: rupees(p.amountPaise),
  }));

  const ticketInfo = [
    { label: "Voucher", value: inv.invoiceNo },
    { label: "Date", value: new Date(inv.createdAt).toLocaleDateString("en-IN") },
    { label: "Cust Name", value: inv.customerName },
    ...(inv.customerPhone ? [{ label: "Phone", value: inv.customerPhone }] : []),
  ];

  const thermalTotals = [
    { label: "Gross Metal Value", value: rupees(totalGoldValuePaise) },
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
    { label: "GRAND TOTAL", value: rupees(inv.grandTotalPaise) },
    { label: "Amount Paid", value: rupees(inv.paidPaise) },
    { label: "OUTSTANDING DUE", value: rupees(inv.balancePaise) },
  ];

  return {
    docType,
    docNumber: inv.invoiceNo,
    recordId: inv.id,
    createdAt: inv.createdAt,
    title: isGst3 ? "Tax Invoice (GST 3%)" : "Retail Invoice",
    fields: {
      badgeTitle,
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
      cashAdvanceLabel: inv.orderAdjustment
        ? `-${rupees(inv.orderAdjustment.cashAdvancePaise)}`
        : "",
      oldGoldLabel: inv.orderAdjustment
        ? `-${rupees(inv.orderAdjustment.goldValuePaise)} (${mgToGrams(inv.orderAdjustment.goldGrossMg)}g)`
        : "",
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
      isNotGst3: !isGst3,
      hasAdjustment: inv.adjustmentPaise > 0,
      // Customer Hisab (metal+cash) is a separate document — never auto-print on invoice.
      showCustomerHisab:
        useSettings.getState().printDocumentPrefs?.hideCustomerHisabOnInvoice === false,
      hideCustomerHisab:
        useSettings.getState().printDocumentPrefs?.hideCustomerHisabOnInvoice !== false,
    },
    images: {},
    balances: {},
  };
}
