/**
 * PDF generator for ERP documents (Invoice, Order, Repair, Manufacturing Bill).
 * Uses jsPDF native text/vector API — no html2canvas, no external images required.
 * Produces mobile-friendly A4 PDFs suitable for sharing via WhatsApp / email.
 */

import { jsPDF } from "jspdf";
import type { FirmProfile } from "@/lib/settings-store";

// ── Helpers ───────────────────────────────────────────────────────────────────

export function paiseToRs(p: number) {
  return (p / 100).toFixed(2);
}
export function mgToG(mg: number) {
  return (mg / 1000).toFixed(3);
}

function purity1000ToLabel(p: number) {
  if (p >= 990) return "999 (24K)";
  if (p >= 915) return "916 (22K)";
  if (p >= 749) return "750 (18K)";
  if (p >= 584) return "585 (14K)";
  return `${p} (Custom)`;
}

// ── Shared layout helpers ─────────────────────────────────────────────────────

const MARGIN = 15;
const PAGE_W = 210;
const CONTENT_W = PAGE_W - MARGIN * 2;
const COL_R = PAGE_W - MARGIN;

function addPageHeader(
  doc: jsPDF,
  firm: FirmProfile,
  docTitle: string,
  docNo: string,
  date: string,
) {
  const y0 = MARGIN;

  // Shop name (bold, large)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(firm.shopName || "Jewellers ERP", MARGIN, y0 + 6);

  // Tagline
  if (firm.tagline) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.text(firm.tagline, MARGIN, y0 + 11);
  }

  // Address / contact
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  let addrY = y0 + 16;
  if (firm.address) {
    doc.text(firm.address, MARGIN, addrY);
    addrY += 4;
  }
  const contact = [firm.phone, firm.email].filter(Boolean).join("  |  ");
  if (contact) {
    doc.text(contact, MARGIN, addrY);
    addrY += 4;
  }
  if (firm.gstin) {
    doc.text(`GSTIN: ${firm.gstin}`, MARGIN, addrY);
  }

  // Document title / number (right-aligned)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(docTitle.toUpperCase(), COL_R, y0 + 6, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`No: ${docNo}`, COL_R, y0 + 12, { align: "right" });
  doc.text(`Date: ${date}`, COL_R, y0 + 17, { align: "right" });

  // Horizontal rule
  const ruleY = y0 + 28;
  doc.setDrawColor(120, 113, 108);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, ruleY, COL_R, ruleY);

  return ruleY + 4;
}

function addTwoColRow(doc: jsPDF, label: string, value: string, y: number, labelW = 55) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(label + ":", MARGIN, y);
  doc.setFont("helvetica", "bold");
  doc.text(value, MARGIN + labelW, y);
  return y + 5;
}

function addHRule(doc: jsPDF, y: number, dashed = false) {
  doc.setDrawColor(180, 170, 160);
  doc.setLineWidth(0.3);
  if (dashed) {
    doc.setLineDashPattern([2, 2], 0);
    doc.line(MARGIN, y, COL_R, y);
    doc.setLineDashPattern([], 0);
  } else {
    doc.line(MARGIN, y, COL_R, y);
  }
  return y + 3;
}

function addSectionTitle(doc: jsPDF, title: string, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(80, 60, 30);
  doc.text(title.toUpperCase(), MARGIN, y);
  doc.setTextColor(0, 0, 0);
  return y + 5;
}

interface TableColumn {
  header: string;
  key: string;
  width: number;
  align?: "left" | "right" | "center";
}

function addTable(
  doc: jsPDF,
  columns: TableColumn[],
  rows: Record<string, string>[],
  startY: number,
  rowHeight = 7,
): number {
  const headerH = 7;

  // Header background
  doc.setFillColor(245, 245, 244);
  doc.rect(MARGIN, startY, CONTENT_W, headerH, "F");

  // Header text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(50, 40, 20);
  let colX = MARGIN + 2;
  for (const col of columns) {
    const textX = col.align === "right" ? colX + col.width - 3 : colX + 1;
    doc.text(col.header, textX, startY + 5, { align: col.align === "right" ? "right" : "left" });
    colX += col.width;
  }

  // Border around header
  doc.setDrawColor(120, 113, 108);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN, startY, CONTENT_W, headerH);

  let y = startY + headerH;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (i % 2 === 1) {
      doc.setFillColor(252, 252, 251);
      doc.rect(MARGIN, y, CONTENT_W, rowHeight, "F");
    }

    colX = MARGIN + 2;
    for (const col of columns) {
      const val = row[col.key] ?? "";
      const textX = col.align === "right" ? colX + col.width - 3 : colX + 1;
      const lines = doc.splitTextToSize(val, col.width - 4);
      doc.text(lines[0], textX, y + 5, { align: col.align === "right" ? "right" : "left" });
      colX += col.width;
    }

    doc.setDrawColor(210, 200, 190);
    doc.line(MARGIN, y + rowHeight, COL_R, y + rowHeight);
    y += rowHeight;
  }

  // Outer border
  doc.setDrawColor(120, 113, 108);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN, startY, CONTENT_W, y - startY);

  return y + 4;
}

function addTotalsBlock(
  doc: jsPDF,
  lines: { label: string; value: string; bold?: boolean }[],
  y: number,
) {
  const blockW = 80;
  const blockX = COL_R - blockW;
  let ry = y;
  for (const line of lines) {
    doc.setFont("helvetica", line.bold ? "bold" : "normal");
    doc.setFontSize(9);
    doc.text(line.label, blockX, ry);
    doc.text(line.value, COL_R, ry, { align: "right" });
    ry += 6;
    if (line.bold) {
      doc.setDrawColor(120, 113, 108);
      doc.setLineWidth(0.4);
      doc.line(blockX, ry - 1, COL_R, ry - 1);
    }
  }
  return ry + 2;
}

function addPageFooter(doc: jsPDF, firm: FirmProfile) {
  const pageH = doc.internal.pageSize.getHeight();
  const footerY = pageH - 15;

  doc.setDrawColor(180, 170, 160);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(MARGIN, footerY, COL_R, footerY);
  doc.setLineDashPattern([], 0);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  const footer =
    firm.footerLine || "Official transaction record. Handcrafted quality and guaranteed purity.";
  doc.text(footer, PAGE_W / 2, footerY + 5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("SYSTEM VERIFIED ORIGINAL COPY", PAGE_W / 2, footerY + 9, { align: "center" });
  doc.setTextColor(0, 0, 0);
}

// ── Invoice PDF ───────────────────────────────────────────────────────────────

export function generateInvoicePdf(inv: any, firm: FirmProfile): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const dateStr = new Date(inv.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" });

  let y = addPageHeader(doc, firm, "Tax Invoice", inv.invoiceNo, dateStr);
  y += 2;

  // Customer section
  y = addSectionTitle(doc, "Billed To", y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(inv.customerName || "Walk-In Customer", MARGIN, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (inv.customerPhone) {
    doc.text(`Phone: ${inv.customerPhone}`, MARGIN, y);
    y += 4;
  }
  if (inv.customerGstin) {
    doc.text(`GSTIN: ${inv.customerGstin}`, MARGIN, y);
    y += 4;
  }
  if (inv.orderNo) {
    doc.text(`Order No: ${inv.orderNo}`, MARGIN, y);
    y += 4;
  }
  y += 2;
  y = addHRule(doc, y, true);

  // Items table
  y = addSectionTitle(doc, "Items", y);
  const itemRows = (inv.items || []).map((it: any, idx: number) => ({
    no: String(idx + 1),
    name: it.itemName || "-",
    purity: purity1000ToLabel(it.purity || 0),
    grossWt: mgToG(it.grossMg || 0) + " g",
    making: `₹${paiseToRs(it.makingChargesPaise || 0)}`,
    stone: `₹${paiseToRs(it.stoneChargesPaise || 0)}`,
    total: `₹${paiseToRs(it.lineTotalPaise || 0)}`,
  }));

  const itemCols: TableColumn[] = [
    { header: "#", key: "no", width: 8 },
    { header: "Item / Description", key: "name", width: 62 },
    { header: "Purity", key: "purity", width: 22 },
    { header: "Gross Wt", key: "grossWt", width: 22, align: "right" },
    { header: "Making", key: "making", width: 22, align: "right" },
    { header: "Total", key: "total", width: 24, align: "right" },
  ];

  y = addTable(doc, itemCols, itemRows, y);
  y += 2;

  // Totals — use cgstPaise/sgstPaise (billing store fields). IGST-mode
  // invoices store the full tax in sgstPaise with cgstPaise = 0 (see
  // computeInvoiceTotals in billing-store.ts) — a plain `if (cgst > 0)`
  // gate silently dropped this line from the printed invoice entirely for
  // every IGST bill, even though the grand total below still included it.
  // That produced a document where the visible line items didn't add up
  // to the grand total shown — exactly the "missing values" defect this
  // audit was looking for. The rate label was also hardcoded to "(1.5%)"
  // regardless of the actually configured GST rate; dropped rather than
  // print a number that may not match what was actually charged.
  const cgst = inv.cgstPaise || 0;
  const sgst = inv.sgstPaise || 0;
  const totalGst = cgst + sgst;
  const totalLines: { label: string; value: string; bold?: boolean }[] = [];
  totalLines.push({ label: "Subtotal", value: `₹${paiseToRs(inv.subtotalPaise || 0)}` });
  if (cgst > 0 && sgst > 0) {
    totalLines.push({ label: "CGST", value: `₹${paiseToRs(cgst)}` });
    totalLines.push({ label: "SGST", value: `₹${paiseToRs(sgst)}` });
  } else if (totalGst > 0) {
    totalLines.push({ label: "IGST", value: `₹${paiseToRs(totalGst)}` });
  }
  // TCS (Tax Collected at Source) — printed as its own line only when
  // actually charged (computeInvoiceTotals only sets this above the
  // configured threshold), so a non-TCS invoice's layout is unchanged.
  if ((inv.tcsPaise || 0) > 0) {
    totalLines.push({ label: "TCS", value: `₹${paiseToRs(inv.tcsPaise)}` });
  }
  if ((inv.adjustmentPaise || 0) > 0) {
    totalLines.push({
      label: "Adjustment (Advance/Gold)",
      value: `- ₹${paiseToRs(inv.adjustmentPaise || 0)}`,
    });
  }
  totalLines.push({
    label: "Grand Total",
    value: `₹${paiseToRs(inv.grandTotalPaise || 0)}`,
    bold: true,
  });
  totalLines.push({ label: "Amount Paid", value: `₹${paiseToRs(inv.paidPaise || 0)}` });
  totalLines.push({
    label: "Balance Due",
    value: `₹${paiseToRs(inv.balancePaise || 0)}`,
    bold: true,
  });

  y = addTotalsBlock(doc, totalLines, y);
  y += 4;

  // GST Gold Equivalent — informational only; shown when Settings → Tax
  // Configuration has "Allow GST Payment in Gold" on. Never implies GST was
  // actually paid in gold — only that it *could* be, at this equivalent.
  if ((inv.gstGoldEquivalentMg || 0) > 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.text(
      `GST amount payable in gold equivalent: ${mgToG(inv.gstGoldEquivalentMg)} g fine`,
      MARGIN,
      y,
    );
    y += 5;
  }

  // Gold / Cash Payment Breakdown — split from the flat Payments table
  // below so a reader can see the asset mix at a glance without adding up
  // individual payment rows.
  const goldReceivedFineMg = (inv.payments || [])
    .filter((p: any) => p.mode === "gold_exchange")
    .reduce((s: number, p: any) => s + (p.goldFineMg || 0), 0);
  const cashReceivedPaise = (inv.payments || [])
    .filter(
      (p: any) =>
        p.mode !== "gold_exchange" &&
        p.mode !== "outstanding" &&
        p.mode !== "customer_gold_credit" &&
        p.mode !== "advance",
    )
    .reduce((s: number, p: any) => s + (p.amountPaise || 0), 0);
  if (goldReceivedFineMg > 0 || cashReceivedPaise > 0) {
    const breakdownLines: { label: string; value: string; bold?: boolean }[] = [];
    if (goldReceivedFineMg > 0) {
      breakdownLines.push({ label: "Gold Received", value: `${mgToG(goldReceivedFineMg)} g fine` });
    }
    if (cashReceivedPaise > 0) {
      breakdownLines.push({ label: "Cash Received", value: `₹${paiseToRs(cashReceivedPaise)}` });
    }
    breakdownLines.push({
      label: "Outstanding Balance",
      value: `₹${paiseToRs(inv.balancePaise || 0)}`,
      bold: true,
    });
    y = addSectionTitle(doc, "Payment Breakdown (Gold / Cash)", y);
    y = addTotalsBlock(doc, breakdownLines, y);
    y += 4;
  }

  // Payments
  if ((inv.payments || []).length > 0) {
    y = addHRule(doc, y, true);
    y = addSectionTitle(doc, "Payments", y);
    const pymtRows = inv.payments.map((p: any) => ({
      date: new Date(p.paidAt || inv.createdAt).toLocaleDateString("en-IN"),
      mode: p.mode?.replace("_", " ").toUpperCase() || "-",
      ref: p.reference || "-",
      amount: `₹${paiseToRs(p.amountPaise || 0)}`,
    }));
    const pymtCols: TableColumn[] = [
      { header: "Date", key: "date", width: 30 },
      { header: "Mode", key: "mode", width: 40 },
      { header: "Reference", key: "ref", width: 60 },
      { header: "Amount", key: "amount", width: 50, align: "right" },
    ];
    y = addTable(doc, pymtCols, pymtRows, y, 6);
  }

  // Notes
  if (inv.notes) {
    y += 2;
    y = addHRule(doc, y, true);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.text(`Note: ${inv.notes}`, MARGIN, y + 3);
    y += 7;
  }

  addPageFooter(doc, firm);
  return doc.output("blob");
}

// ── Order PDF ─────────────────────────────────────────────────────────────────

export function generateOrderPdf(order: any, firm: FirmProfile): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const dateStr = new Date(order.createdAt || Date.now()).toLocaleDateString("en-IN", {
    dateStyle: "medium",
  });

  let y = addPageHeader(doc, firm, "Work Order", order.orderNo || order.id, dateStr);
  y += 2;

  // Customer
  y = addSectionTitle(doc, "Customer", y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(order.customerName || order.customer?.name || "-", MARGIN, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const phone = order.customerPhone || order.customer?.phone;
  if (phone) {
    doc.text(`Phone: ${phone}`, MARGIN, y);
    y += 4;
  }
  y += 2;
  y = addHRule(doc, y, true);

  // Item details
  y = addSectionTitle(doc, "Order Details", y);
  const item = order.item || order;
  const fields: [string, string][] = [
    ["Item", item.itemName || "-"],
    ["Category", item.category || "-"],
    ["Purity", purity1000ToLabel(item.purity || 0)],
    ["Gross Weight", mgToG(item.grossMg || 0) + " g"],
    ["Net Weight", mgToG(item.netMg || 0) + " g"],
    ["Delivery Date", order.deliveryDate || order.expectedDelivery || "TBD"],
    ["Status", (order.status || "pending").toUpperCase()],
  ];
  for (const [label, value] of fields) {
    y = addTwoColRow(doc, label, value, y);
  }
  if (order.designNotes || order.notes) {
    y += 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Notes: ${order.designNotes || order.notes}`, MARGIN, y);
    y += 5;
  }
  y += 2;
  y = addHRule(doc, y, true);

  // Financials — order.advance.cashPaise is the actual store field
  y = addSectionTitle(doc, "Financials", y);
  const cashAdvance = order.advance?.cashPaise || 0;
  const labourRs = order.item?.labourRupees || 0;
  const amountRs = order.item?.amountRupees || 0;
  const finFields: [string, string][] = [
    ...(amountRs > 0 ? [["Estimated Amount", `₹${amountRs.toFixed(2)}`] as [string, string]] : []),
    ["Cash Advance", `₹${paiseToRs(cashAdvance)}`],
    ...(labourRs > 0 ? [["Labour / Making", `₹${labourRs.toFixed(2)}`] as [string, string]] : []),
  ];
  for (const [label, value] of finFields) {
    y = addTwoColRow(doc, label, value, y);
  }

  addPageFooter(doc, firm);
  return doc.output("blob");
}

// ── Repair PDF ────────────────────────────────────────────────────────────────

export function generateRepairPdf(repair: any, firm: FirmProfile): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const dateStr = new Date(repair.createdAt || Date.now()).toLocaleDateString("en-IN", {
    dateStyle: "medium",
  });

  let y = addPageHeader(doc, firm, "Repair Job Card", repair.jobNo || repair.id, dateStr);
  y += 2;

  // Customer
  y = addSectionTitle(doc, "Customer", y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(repair.customerName || "-", MARGIN, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (repair.customerPhone) {
    doc.text(`Phone: ${repair.customerPhone}`, MARGIN, y);
    y += 4;
  }
  y += 2;
  y = addHRule(doc, y, true);

  // Job details
  y = addSectionTitle(doc, "Repair Details", y);
  const fields: [string, string][] = [
    ["Item", repair.itemName || repair.item || "-"],
    ["Category", repair.category || "-"],
    ["Description", repair.description || repair.jobDescription || "-"],
    ["Weight In", mgToG(repair.weightInMg || 0) + " g"],
    ["Expected Delivery", repair.expectedDelivery || repair.deliveryDate || "TBD"],
    ["Status", (repair.status || "pending").toUpperCase()],
  ];
  for (const [label, value] of fields) {
    y = addTwoColRow(doc, label, value, y);
  }
  y += 2;
  y = addHRule(doc, y, true);

  // Charges — advancePaise is the store field name
  y = addSectionTitle(doc, "Charges", y);
  const advance = repair.advancePaise || repair.advancePaidPaise || 0;
  const estimated = repair.estimatedChargePaise || 0;
  const charges: [string, string][] = [
    ["Estimated Charge", `₹${paiseToRs(estimated)}`],
    ["Advance Paid", `₹${paiseToRs(advance)}`],
    ["Balance Due", `₹${paiseToRs(estimated - advance)}`],
  ];
  for (const [label, value] of charges) {
    y = addTwoColRow(doc, label, value, y);
  }

  addPageFooter(doc, firm);
  return doc.output("blob");
}

// ── Manufacturing Bill PDF ────────────────────────────────────────────────────

export function generateManufacturingBillPdf(bill: any, firm: FirmProfile): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const dateStr = new Date(bill.createdAt || Date.now()).toLocaleDateString("en-IN", {
    dateStyle: "medium",
  });

  let y = addPageHeader(doc, firm, "Manufacturing Bill", bill.billNo || bill.id, dateStr);
  y += 2;

  // Karigar
  y = addSectionTitle(doc, "Karigar / Worker", y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(bill.karigarName || bill.workerName || "-", MARGIN, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (bill.karigarPhone || bill.workerPhone) {
    doc.text(`Phone: ${bill.karigarPhone || bill.workerPhone}`, MARGIN, y);
    y += 4;
  }
  y += 2;
  y = addHRule(doc, y, true);

  // Gold account
  y = addSectionTitle(doc, "Gold Account", y);
  const goldFields: [string, string][] = [
    ["Gold Issued (Jama)", mgToG(bill.goldIssuedMg || 0) + " g"],
    ["Gold Received (Naam)", mgToG(bill.goldReceivedMg || 0) + " g"],
    ["Balance Gold", mgToG((bill.goldIssuedMg || 0) - (bill.goldReceivedMg || 0)) + " g"],
    ["Making Charge", `₹${paiseToRs(bill.makingChargePaise || 0)}`],
    ["Wastage", mgToG(bill.wastageMg || 0) + " g"],
  ];
  for (const [label, value] of goldFields) {
    y = addTwoColRow(doc, label, value, y);
  }

  if ((bill.items || []).length > 0) {
    y += 4;
    y = addSectionTitle(doc, "Items", y);
    const itemRows = bill.items.map((it: any, i: number) => ({
      no: String(i + 1),
      name: it.itemName || "-",
      grossWt: mgToG(it.grossMg || 0) + " g",
      making: `₹${paiseToRs(it.makingChargePaise || 0)}`,
    }));
    const cols: TableColumn[] = [
      { header: "#", key: "no", width: 10 },
      { header: "Item", key: "name", width: 100 },
      { header: "Gross Wt", key: "grossWt", width: 35, align: "right" },
      { header: "Making", key: "making", width: 35, align: "right" },
    ];
    y = addTable(doc, cols, itemRows, y);
  }

  addPageFooter(doc, firm);
  return doc.output("blob");
}

// ── Dispatch helper ───────────────────────────────────────────────────────────

export type PdfDocumentType = "invoice" | "order" | "repair" | "manufacturing_bill";

export async function generateDocumentPdf(
  docType: PdfDocumentType,
  docData: any,
  firm: FirmProfile,
): Promise<{ blob: Blob; fileName: string }> {
  let blob: Blob;
  let docNo: string;

  switch (docType) {
    case "invoice":
      blob = generateInvoicePdf(docData, firm);
      docNo = docData.invoiceNo || docData.id;
      break;
    case "order":
      blob = generateOrderPdf(docData, firm);
      docNo = docData.orderNo || docData.id;
      break;
    case "repair":
      blob = generateRepairPdf(docData, firm);
      docNo = docData.jobNo || docData.id;
      break;
    case "manufacturing_bill":
      blob = generateManufacturingBillPdf(docData, firm);
      docNo = docData.billNo || docData.id;
      break;
    default:
      throw new Error(`Unknown document type: ${docType}`);
  }

  const safeName = docNo.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `${firm.shopName?.replace(/\s+/g, "_") || "ERP"}_${docType}_${safeName}.pdf`;

  return { blob, fileName };
}
