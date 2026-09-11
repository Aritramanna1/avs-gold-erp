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
  if (it.imageUrl) return it.imageUrl;
  if ((it as any).photoUrl) return (it as any).photoUrl;
  if ((it as any).photoDataUrl) return (it as any).photoDataUrl;

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
  const lines: string[] = [it.itemName || "Ornament"];
  const meta: string[] = [];
  const metal = it.metalKind === "silver" ? "Silver" : "Gold";
  const jn = it.jn === 2 ? "Nave (N)" : "Jama (J)";
  meta.push(`${metal} (${jn}) · ${it.pcs ?? 1} Pc`);
  if (it.category && it.category !== "Other") meta.push(it.category);
  if (it.huid) meta.push(`HUID: ${it.huid}`);
  if (it.barcode) meta.push(`Tag: ${it.barcode}`);
  if (it.hsnCode) meta.push(`HSN: ${it.hsnCode}`);
  if (it.stoneWeightMg && it.stoneWeightMg > 0) meta.push(`Stone: ${mgToGrams(it.stoneWeightMg)}g`);
  if (it.diamondWeightMg && it.diamondWeightMg > 0) meta.push(`Dia: ${(it.diamondWeightMg / 200).toFixed(2)}ct`);
  if (meta.length > 0) {
    lines.push(meta.join("  |  "));
  }
  return lines.join("\n");
}

export function buildInvoicePrintData(inv: Invoice): PrintDocumentData {
  const docType = inv.gst === "gst3" ? "gst_invoice" : "retail_invoice";
  const badgeTitle = inv.gst === "gst3" ? "Tax Invoice (3% GST)" : "Retail Cash Memo";

  const itemsList = Array.isArray(inv.items) ? inv.items : [];
  const totalGrossMg = itemsList.reduce((a, it) => a + (it.grossMg || 0), 0);
  const totalNetMg = itemsList.reduce((a, it) => a + (it.netMg || 0), 0);
  const totalFineMg = itemsList.reduce((a, it) => a + (it.fineMg || 0), 0);
  const totalGoldValuePaise = itemsList.reduce((a, it) => a + (it.goldValuePaise || 0), 0);
  const totalMakingChargesPaise = itemsList.reduce((a, it) => a + (it.makingChargesPaise || 0), 0);
  const totalStoneChargesPaise = itemsList.reduce((a, it) => a + (it.stoneChargesPaise || 0), 0);
  const totalHallmarkChargesPaise = itemsList.reduce(
    (a, it) => a + (it.hallmarkChargesPaise || 0),
    0,
  );
  const totalOtherChargesPaise = itemsList.reduce((a, it) => a + (it.otherChargesPaise || 0), 0);
  const totalDiscountPaise = itemsList.reduce((a, it) => a + (it.discountPaise || 0), 0);
  const totalLineTotalPaise = itemsList.reduce((a, it) => a + (it.lineTotalPaise || 0), 0);
  const hasHallmarkCharges = totalHallmarkChargesPaise > 0;
  const hasOtherCharges = totalOtherChargesPaise > 0;
  const hasCgstSgst = inv.cgstPaise > 0 && inv.sgstPaise > 0;
  const isGst3 = inv.gst === "gst3";

  const isPureGoldInvoice =
    inv.transactionMode === "gold" ||
    (inv.transactionMode !== "cash" &&
      ((inv.billingType as string) === "job_work" ||
        (inv.billingType as string) === "wholesale" ||
        (inv.billingType as string) === "gold" ||
        (inv.items || []).some(
          (it) =>
            it.chargeMode === "job_work" ||
            (it.hallmarkChargesGoldMg ?? 0) > 0 ||
            (it.makingChargesGoldMg ?? 0) > 0 ||
            (it.otherChargesGoldMg ?? 0) > 0 ||
            (it.stoneChargesGoldMg ?? 0) > 0,
        ) ||
        ((inv.payments || []).length > 0 &&
          (inv.payments || []).every(
            (p) =>
              p.mode === "gold_exchange" ||
              p.mode === "customer_gold_credit" ||
              ((p.goldFineMg ?? 0) > 0 && (p.amountPaise ?? 0) === 0),
          )) ||
        (inv.paidPaise === 0 && (inv.payments || []).some((p) => (p.goldFineMg ?? 0) > 0))));

  const actualGoldPaidMg = (inv.payments || []).reduce((sum, p) => {
    if (p.mode === "gold_exchange" || p.mode === "customer_gold_credit" || (p.goldFineMg && p.goldFineMg > 0)) {
      return sum + (p.goldFineMg || p.goldGrossMg || 0);
    }
    const rateUsed = p.goldRatePerGramPaise || 750000;
    const equiv = rateUsed > 0 ? Math.round((p.amountPaise * 1000) / rateUsed) : 0;
    return sum + equiv;
  }, 0);

  const totalPaidGoldMg =
    actualGoldPaidMg > 0
      ? actualGoldPaidMg
      : inv.grandTotalPaise > 0
        ? Math.round((totalFineMg * (inv.paidPaise || 0)) / inv.grandTotalPaise)
        : (inv.payments || []).reduce((sum, p) => sum + (p.goldFineMg || 0), 0);

  const excessGoldMg = Math.max(0, totalPaidGoldMg - totalFineMg);
  const remainingGoldDueMg = Math.max(0, totalFineMg - totalPaidGoldMg);

  const fallbackRatePaise =
    inv.items[0]?.goldRatePerGramPaise ||
    (Array.isArray(inv.payments) ? inv.payments : []).find((p) => (p.goldRatePerGramPaise ?? 0) > 0)?.goldRatePerGramPaise ||
    750000;

  const makingChargesGoldEquivMg = fallbackRatePaise > 0 ? Math.round((totalMakingChargesPaise * 1000) / fallbackRatePaise) : 0;
  const hallmarkChargesGoldEquivMg = fallbackRatePaise > 0 ? Math.round((totalHallmarkChargesPaise * 1000) / fallbackRatePaise) : 0;
  const stoneChargesGoldEquivMg = fallbackRatePaise > 0 ? Math.round((totalStoneChargesPaise * 1000) / fallbackRatePaise) : 0;
  const otherChargesGoldEquivMg = fallbackRatePaise > 0 ? Math.round((totalOtherChargesPaise * 1000) / fallbackRatePaise) : 0;
  const gstChargesGoldEquivMg = fallbackRatePaise > 0 ? Math.round(((inv.cgstPaise + inv.sgstPaise) * 1000) / fallbackRatePaise) : 0;

  const items = inv.items.map((it) => {
    const tanchPct = it.purity ? it.purity / 10 : 0;
    const wstgPct = it.wastagePct != null ? Number(it.wastagePct) : 0;
    const hisobPct =
      it.hisobPct != null && Number.isFinite(Number(it.hisobPct))
        ? Number(it.hisobPct)
        : Math.round((tanchPct + wstgPct) * 100) / 100;
    const jn = it.jn === 2 ? "N" : "J";
    const metal = it.metalKind === "silver" ? "Silver" : "Gold";
    const diamondCt = it.diamondWeightMg ? (it.diamondWeightMg / 200).toFixed(2) : "0";

    const makingStr = isPureGoldInvoice
      ? (it.makingChargesGoldMg ? `${mgToGrams(it.makingChargesGoldMg)}g` : "0.000g")
      : rupees(it.makingChargesPaise);
    const hmStr = isPureGoldInvoice
      ? (it.hallmarkChargesGoldMg ? `${mgToGrams(it.hallmarkChargesGoldMg)}g` : "0.000g")
      : rupees(it.hallmarkChargesPaise || 0);

    return {
      photoUrl: getItemPhoto(it, inv.orderId) ?? "",
      description: itemDescription(it),
      metalKind: metal,
      jnLabel: jn,
      pcs: it.pcs != null ? String(it.pcs) : "1",
      grossWt: `${mgToGrams(it.grossMg)}`,
      lessWt: `${mgToGrams(it.lessMg || 0)}`,
      addWt: `${mgToGrams(it.addMg || 0)}`,
      netWt: `${mgToGrams(it.netMg)}`,
      tanch: it.purity ? tanchPct.toFixed(2) : "91.60",
      wstg: it.wastagePct != null ? wstgPct.toFixed(2) : "0.00",
      tanchWstg: `${tanchPct.toFixed(2)}% + ${wstgPct.toFixed(2)}%`,
      hisob: hisobPct > 0 ? `${hisobPct.toFixed(2)}%` : `${(tanchPct + wstgPct).toFixed(2)}%`,
      fineWt: `${mgToGrams(it.fineMg)}`,
      purity: String(it.purity),
      rateLabel:
        it.goldRatePerGramPaise > 0
          ? rupees(it.goldRatePerGramPaise)
          : isPureGoldInvoice
            ? `${(it.purity ? it.purity / 10 : 91.6).toFixed(1)}% Touch`
            : it.purity
              ? `${(it.purity / 10).toFixed(1)}% (${it.purity} T)`
              : "—",
      goldValueLabel: isPureGoldInvoice ? `${mgToGrams(it.fineMg)} g` : rupees(it.goldValuePaise),
      makingLabel: makingStr,
      hallmarkLabel: hmStr,
      chargesBreakdown: `M: ${makingStr} | HM: ${hmStr}`,
      stoneLabel: isPureGoldInvoice ? (it.stoneChargesGoldMg ? `${mgToGrams(it.stoneChargesGoldMg)} g` : "0.000 g") : rupees(it.stoneChargesPaise),
      stoneWeight: it.stoneWeightMg ? `${mgToGrams(it.stoneWeightMg)}` : "0.000",
      diamondCt: diamondCt,
      otherLabel: isPureGoldInvoice ? (it.otherChargesGoldMg ? `${mgToGrams(it.otherChargesGoldMg)} g` : "0.000 g") : rupees(it.otherChargesPaise),
      additionalBreakdown: [
        {
          label: "Gold",
          value: isPureGoldInvoice ? `${mgToGrams(it.fineMg)} g` : rupees(it.goldValuePaise),
        },
        { label: "Making", value: makingStr },
        ...(it.markingChargesGoldMg
          ? [{ label: "Labour", value: `${mgToGrams(it.markingChargesGoldMg)}g` }]
          : []),
        {
          label: "HM",
          value: hmStr,
          extra: it.huid ? `HUID: ${it.huid}` : undefined,
        },
        {
          label: "Stone",
          value: isPureGoldInvoice
            ? it.stoneChargesGoldMg
              ? `${mgToGrams(it.stoneChargesGoldMg)} g`
              : "0.000 g"
            : rupees(it.stoneChargesPaise),
          extra: it.stoneWeightMg ? `${mgToGrams(it.stoneWeightMg)}g Wt` : undefined,
        },
        { label: "Dia", value: `${diamondCt} ct`, show: (it.diamondWeightMg ?? 0) > 0 },
        {
          label: "Other",
          value: isPureGoldInvoice
            ? it.otherChargesGoldMg
              ? `${mgToGrams(it.otherChargesGoldMg)} g`
              : "0.000 g"
            : rupees(it.otherChargesPaise),
        },
        {
          label: "Disc",
          value: isPureGoldInvoice
            ? it.discountGoldMg
              ? `-${mgToGrams(it.discountGoldMg)} g`
              : "0.000 g"
            : it.discountPaise
              ? `-${rupees(it.discountPaise)}`
              : "0.000 g",
        },
        {
          label: "Total",
          value: isPureGoldInvoice ? `${mgToGrams(it.fineMg)} g` : rupees(it.lineTotalPaise),
          emphasis: true,
        },
      ],
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
    };
  });

  const totalLessMg = inv.items.reduce((a, it) => a + (it.lessMg || 0), 0);
  const totalAddMg = inv.items.reduce((a, it) => a + (it.addMg || 0), 0);
  const totalPcs = inv.items.reduce((a, it) => a + (it.pcs ?? 1), 0);
  const totalStoneWeightMg = inv.items.reduce((a, it) => a + (it.stoneWeightMg || 0), 0);
  const totalDiamondWeightMg = inv.items.reduce((a, it) => a + (it.diamondWeightMg || 0), 0);

  const itemsTotals = [
    {
      description: "Totals",
      metalKind: "—",
      jnLabel: "—",
      pcs: String(totalPcs),
      grossWt: `${mgToGrams(totalGrossMg)}`,
      lessWt: `${mgToGrams(totalLessMg)}`,
      addWt: `${mgToGrams(totalAddMg)}`,
      netWt: `${mgToGrams(totalNetMg)}`,
      tanch: "—",
      wstg: "—",
      tanchWstg: "—",
      hisob: "—",
      fineWt: `${mgToGrams(totalFineMg)}`,
      purity: "—",
      rateLabel: "—",
      goldValueLabel: isPureGoldInvoice ? `${mgToGrams(totalFineMg)} g` : rupees(totalGoldValuePaise),
      makingLabel: isPureGoldInvoice ? (makingChargesGoldEquivMg > 0 ? `${mgToGrams(makingChargesGoldEquivMg)} g` : "0.000 g") : rupees(totalMakingChargesPaise),
      hallmarkLabel: isPureGoldInvoice ? (hallmarkChargesGoldEquivMg > 0 ? `${mgToGrams(hallmarkChargesGoldEquivMg)} g` : "0.000 g") : rupees(totalHallmarkChargesPaise),
      chargesBreakdown: "—",
      stoneLabel: isPureGoldInvoice ? (stoneChargesGoldEquivMg > 0 ? `${mgToGrams(stoneChargesGoldEquivMg)} g` : "0.000 g") : rupees(totalStoneChargesPaise),
      stoneWeight: `${mgToGrams(totalStoneWeightMg)}`,
      diamondCt: totalDiamondWeightMg > 0 ? `${(totalDiamondWeightMg / 200).toFixed(2)}` : "0",
      otherLabel: isPureGoldInvoice ? (otherChargesGoldEquivMg > 0 ? `${mgToGrams(otherChargesGoldEquivMg)} g` : "0.000 g") : rupees(totalOtherChargesPaise),
      discountLabel: `-${rupees(totalDiscountPaise)}`,
      totalLabel: isPureGoldInvoice ? `${mgToGrams(totalFineMg)} g` : rupees(totalLineTotalPaise),
      huid: "",
      barcode: "",
      hsnCode: "",
    },
  ];

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

  const thermalTotals = isPureGoldInvoice
    ? [
        { label: "Total Fine Gold (995)", value: `${mgToGrams(totalFineMg)} g Fine Gold` },
        ...(makingChargesGoldEquivMg > 0
          ? [{ label: "Labour / Making (Gold)", value: `${mgToGrams(makingChargesGoldEquivMg)} g Fine Gold` }]
          : []),
        ...(hallmarkChargesGoldEquivMg > 0
          ? [{ label: "Hallmark (Gold)", value: `${mgToGrams(hallmarkChargesGoldEquivMg)} g Fine Gold` }]
          : []),
        ...(stoneChargesGoldEquivMg > 0
          ? [{ label: "Stone (Gold)", value: `${mgToGrams(stoneChargesGoldEquivMg)} g Fine Gold` }]
          : []),
        ...(otherChargesGoldEquivMg > 0
          ? [{ label: "Other Charges (Gold)", value: `${mgToGrams(otherChargesGoldEquivMg)} g Fine Gold` }]
          : []),
        ...(isGst3 && gstChargesGoldEquivMg > 0
          ? [{ label: "GST 3% (Gold Equiv)", value: `${mgToGrams(gstChargesGoldEquivMg)} g Fine Gold` }]
          : []),
        { label: "GRAND TOTAL (GOLD)", value: `${mgToGrams(totalFineMg)} g Fine Gold` },
        { label: "Total Paid (Gold)", value: `${mgToGrams(totalPaidGoldMg)} g Fine Gold` },
        { label: "OUTSTANDING DUE (GOLD)", value: `${mgToGrams(remainingGoldDueMg)} g Fine Gold` },
      ]
    : [
        { label: "Gross Metal Value", value: rupees(totalGoldValuePaise) },
        { label: "Total Fine Gold", value: `${mgToGrams(totalFineMg)} g Fine Gold` },
        {
          label: "Labour / Making Charge",
          value: rupees(totalMakingChargesPaise),
        },
        ...(totalHallmarkChargesPaise > 0
          ? [{ label: "Hallmark Charge", value: rupees(totalHallmarkChargesPaise) }]
          : []),
        ...(totalStoneChargesPaise > 0
          ? [{ label: "Stone Charge", value: rupees(totalStoneChargesPaise) }]
          : []),
        ...(totalOtherChargesPaise > 0
          ? [{ label: "Other Charges", value: rupees(totalOtherChargesPaise) }]
          : []),
        ...(isGst3
          ? [{ label: "GST (3%)", value: rupees(inv.cgstPaise + inv.sgstPaise) }]
          : []),
        ...(totalDiscountPaise > 0
          ? [{ label: "Discount", value: `-${rupees(totalDiscountPaise)}` }]
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
    title: isGst3 ? "Tax Invoice (GST 3%)" : isPureGoldInvoice ? "Wholesale Gold Invoice" : "Retail Invoice",
    fields: {
      badgeTitle: isPureGoldInvoice ? (isGst3 ? "Tax Invoice (Gold 995 Basis)" : "Gold Settlement Memo") : badgeTitle,
      invoiceNo: inv.invoiceNo,
      invoiceDate: new Date(inv.createdAt).toLocaleDateString("en-IN"),
      customerName: inv.customerName,
      customerPhone: inv.customerPhone || "",
      customerGstin: inv.customerGstin || "",
      orderNo: inv.orderNo || "",
      jobNo: inv.jobNo || "",
      ownerName: "Authorised Signatory",
      amountInWordsText: isPureGoldInvoice
        ? `${mgToGrams(totalFineMg)} Grams Fine Gold Only (995 Touch Basis)`
        : rupeesToWords(inv.grandTotalPaise),
      goldValueLabel: isPureGoldInvoice ? `${mgToGrams(totalFineMg)} g Fine Gold` : rupees(totalGoldValuePaise),
      makingLabel: isPureGoldInvoice ? (makingChargesGoldEquivMg > 0 ? `${mgToGrams(makingChargesGoldEquivMg)} g Fine Gold` : "0.000 g") : rupees(totalMakingChargesPaise),
      stoneLabel: isPureGoldInvoice ? (stoneChargesGoldEquivMg > 0 ? `${mgToGrams(stoneChargesGoldEquivMg)} g Fine Gold` : "0.000 g") : rupees(totalStoneChargesPaise),
      hallmarkLabel: isPureGoldInvoice ? (hallmarkChargesGoldEquivMg > 0 ? `${mgToGrams(hallmarkChargesGoldEquivMg)} g Fine Gold` : "0.000 g") : rupees(totalHallmarkChargesPaise),
      otherLabel: isPureGoldInvoice ? (otherChargesGoldEquivMg > 0 ? `${mgToGrams(otherChargesGoldEquivMg)} g Fine Gold` : "0.000 g") : rupees(totalOtherChargesPaise),
      makingChargesEquivGold: `${mgToGrams(makingChargesGoldEquivMg)} g`,
      hallmarkChargesEquivGold: `${mgToGrams(hallmarkChargesGoldEquivMg)} g`,
      stoneChargesEquivGold: `${mgToGrams(stoneChargesGoldEquivMg)} g`,
      otherChargesEquivGold: `${mgToGrams(otherChargesGoldEquivMg)} g`,
      gstEquivGold: `${mgToGrams(gstChargesGoldEquivMg)} g`,
      discountLabel: isPureGoldInvoice ? "0.000 g" : `-${rupees(totalDiscountPaise)}`,
      subtotalLabel: isPureGoldInvoice ? `${mgToGrams(totalFineMg)} g Fine Gold` : rupees(inv.subtotalPaise),
      cgstLabel: isPureGoldInvoice ? (gstChargesGoldEquivMg > 0 ? `${mgToGrams(Math.round(gstChargesGoldEquivMg / 2))} g Fine Gold` : "0.000 g") : rupees(inv.cgstPaise),
      sgstLabel: isPureGoldInvoice ? (gstChargesGoldEquivMg > 0 ? `${mgToGrams(Math.round(gstChargesGoldEquivMg / 2))} g Fine Gold` : "0.000 g") : rupees(inv.sgstPaise),
      igstLabel: isPureGoldInvoice ? (gstChargesGoldEquivMg > 0 ? `${mgToGrams(gstChargesGoldEquivMg)} g Fine Gold` : "0.000 g") : rupees(inv.cgstPaise + inv.sgstPaise),
      gstExemptText: "Composition Exempt",
      adjustmentLabel: isPureGoldInvoice ? "" : `-${rupees(inv.adjustmentPaise)}`,
      grandTotalLabel: isPureGoldInvoice ? `${mgToGrams(totalFineMg)} g Fine Gold` : rupees(inv.grandTotalPaise),
      goldGrandTotalLabel: `${mgToGrams(totalFineMg)} g Fine Gold`,
      goldPaidLabel: `${mgToGrams(totalPaidGoldMg)} g Fine Gold`,
      goldBalanceLabel: `${mgToGrams(remainingGoldDueMg)} g Fine Gold`,
      excessGoldMg: excessGoldMg,
      excessGoldLabel: `${mgToGrams(excessGoldMg)} g Fine Gold`,
      excessGoldNote: excessGoldMg > 0 ? `Excess credited to Customer Ledger: +${mgToGrams(excessGoldMg)} g Fine Gold` : "",
      excessLedgerCreditLabel: `Excess credited to Customer Ledger: +${mgToGrams(excessGoldMg)} g Fine Gold`,
      hasExcessGold: excessGoldMg > 0,
      paidLabel: isPureGoldInvoice ? `${mgToGrams(totalPaidGoldMg)} g Fine Gold` : rupees(inv.paidPaise),
      balanceLabel: isPureGoldInvoice ? `${mgToGrams(remainingGoldDueMg)} g Fine Gold` : rupees(inv.balancePaise),
      narration: inv.notes || "",
      haste: inv.haste || "",
      dayRateLabel:
        inv.items[0]?.goldRatePerGramPaise
          ? rupees(inv.items[0].goldRatePerGramPaise)
          : isPureGoldInvoice
            ? `${((inv.items[0]?.purity || 916) / 10).toFixed(1)}% Touch`
            : "",
      paymentStatusLabel: JEWELLERY_PAYMENT_STATUS_LABELS[jewelleryPaymentStatus(inv)],
      dueDate: inv.dueAt ? new Date(inv.dueAt).toLocaleDateString("en-IN") : "",
      gstSummaryLabel: isPureGoldInvoice
        ? ""
        : isGst3
          ? hasCgstSgst
            ? `CGST ${rupees(inv.cgstPaise)} + SGST ${rupees(inv.sgstPaise)}`
            : `GST ${rupees(inv.cgstPaise + inv.sgstPaise)}`
          : "",
      cashAdvanceLabel: isPureGoldInvoice
        ? ""
        : inv.orderAdjustment
          ? `-${rupees(inv.orderAdjustment.cashAdvancePaise)}`
          : "",
      oldGoldLabel: inv.orderAdjustment
        ? isPureGoldInvoice
          ? `${mgToGrams(inv.orderAdjustment.goldGrossMg)} g Old Gold`
          : `-${rupees(inv.orderAdjustment.goldValuePaise)} (${mgToGrams(inv.orderAdjustment.goldGrossMg)}g)`
        : "",
      tcsLabel: isPureGoldInvoice ? "" : inv.tcsPaise > 0 ? rupees(inv.tcsPaise) : "",
      placeOfSupply: inv.placeOfSupply || "",
      paymentModeLabel: isPureGoldInvoice
        ? "Gold Settlement (Physical Metal)"
        : (Array.isArray(inv.payments) ? inv.payments : []).length
          ? (Array.isArray(inv.payments) ? inv.payments : [])
              .map((p) => PAYMENT_MODE_LABELS[p.mode] ?? p.mode)
              .join(", ")
          : "",
      roundOffLabel:
        !isPureGoldInvoice && inv.roundOffPaise != null && inv.roundOffPaise !== 0
          ? rupees(inv.roundOffPaise)
          : "",
      openingFineLabel: (() => {
        if (inv.partyPrintSnapshot?.openingFineMg != null) {
          return `${mgToGrams(inv.partyPrintSnapshot.openingFineMg)} g`;
        }
        if (inv.customerId) {
          const l = compileCustomerLedger(inv.customerId);
          return `${mgToGrams(l.openingGoldMg)} g`;
        }
        return "";
      })(),
      closingFineLabel: (() => {
        if (inv.partyPrintSnapshot?.closingFineMg != null) {
          return `${mgToGrams(inv.partyPrintSnapshot.closingFineMg)} g`;
        }
        if (inv.customerId) {
          const l = compileCustomerLedger(inv.customerId);
          return `${mgToGrams(l.closingGoldMg)} g`;
        }
        return "";
      })(),
      openingCashLabel: isPureGoldInvoice
        ? ""
        : (() => {
            if (inv.partyPrintSnapshot?.openingCashPaise != null) {
              return rupees(inv.partyPrintSnapshot.openingCashPaise);
            }
            if (inv.customerId) {
              const l = compileCustomerLedger(inv.customerId);
              return rupees(l.openingMoneyPaise);
            }
            return "";
          })(),
      closingCashLabel: isPureGoldInvoice
        ? ""
        : (() => {
            if (inv.partyPrintSnapshot?.closingCashPaise != null) {
              return rupees(inv.partyPrintSnapshot.closingCashPaise);
            }
            if (inv.customerId) {
              const l = compileCustomerLedger(inv.customerId);
              return rupees(l.closingMoneyPaise);
            }
            return "";
          })(),
      anamatLabel:
        !isPureGoldInvoice && inv.partyPrintSnapshot?.anamatPaise != null && inv.partyPrintSnapshot.anamatPaise > 0
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
      totalPaise: isPureGoldInvoice ? 0 : inv.grandTotalPaise,
    },
    tables: { items, itemsTotals, payments, ticketInfo, thermalTotals },
    flags: {
      isPureGold: isPureGoldInvoice,
      isGoldOnly: isPureGoldInvoice,
      hasCash: !isPureGoldInvoice && (inv.grandTotalPaise > 0 || inv.paidPaise > 0 || inv.subtotalPaise > 0),
      hasCustomerPhone: !!inv.customerPhone,
      hasCustomerGstin: !!inv.customerGstin,
      hasOrderNo: !!inv.orderNo,
      hasJobNo: !!inv.jobNo,
      hasHallmarkCharges,
      hasOtherCharges,
      hasStoneCharges: totalStoneChargesPaise > 0,
      hasDiscount: !isPureGoldInvoice && totalDiscountPaise > 0,
      hasPayments: inv.payments.length > 0,
      hasOrderAdjustment: !isPureGoldInvoice && !!inv.orderAdjustment,
      hasOrderAdjustmentCash: !isPureGoldInvoice && !!inv.orderAdjustment && inv.orderAdjustment.cashAdvancePaise > 0,
      hasOrderAdjustmentGold: !!inv.orderAdjustment && (inv.orderAdjustment.goldGrossMg > 0 || inv.orderAdjustment.goldValuePaise > 0),
      hasCgstSgst: !isPureGoldInvoice && hasCgstSgst,
      hasIgstOnly: !isPureGoldInvoice && isGst3 && !hasCgstSgst,
      hasGst: !isPureGoldInvoice && isGst3 && (inv.cgstPaise > 0 || inv.sgstPaise > 0),
      isNotGst3: !isGst3,
      hasAdjustment: !isPureGoldInvoice && inv.adjustmentPaise > 0,
      hasNarration: !!inv.notes,
      hasDueDate: !!inv.dueAt,
      hasHaste: !!inv.haste,
      hasSalesman: !!inv.salesman,
      hasBalance: isPureGoldInvoice ? remainingGoldDueMg > 0 : inv.balancePaise > 0,
      hasHuid: inv.items.some((it) => !!it.huid),
      hasPcs: inv.items.some((it) => (it.pcs ?? 0) > 0),
      hasWastage: inv.items.some((it) => (it.wastagePct ?? 0) > 0),
      hasAddWt: inv.items.some((it) => (it.addMg ?? it.stoneWeightMg ?? 0) > 0),
      hasBarcode: inv.items.some((it) => !!it.barcode),
      hasHsn: inv.items.some((it) => !!it.hsnCode),
      hasTcs: !isPureGoldInvoice && (inv.tcsPaise ?? 0) > 0,
      hasPlaceOfSupply: !!inv.placeOfSupply,
      hasRoundOff: !isPureGoldInvoice && !!(inv.roundOffPaise && inv.roundOffPaise !== 0),
      hasPartyPrintSnapshot: !!inv.partyPrintSnapshot || !!inv.customerId,
      hasPaymentModeLabel: inv.payments.length > 0,
      hasBankDetails: !isPureGoldInvoice && !!useSettings.getState().firm?.bankDetails?.bankName,
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
