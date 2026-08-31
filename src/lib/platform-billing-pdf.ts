/**
 * Platform billing document PDF — A4 portrait via jsPDF (not browser print screenshot).
 */
import { jsPDF } from "jspdf";
import type { PlatformPrintDoc } from "@/lib/platform-invoice-adapter";

export type PlatformBranding = {
  companyName: string;
  legalName?: string;
  address?: string;
  email?: string;
  phone?: string;
  website?: string;
  gstin?: string;
  logoDataUrl?: string | null;
};

export type PlatformBillingPdfInput = {
  doc: PlatformPrintDoc;
  buyerName: string;
  buyerAddress?: string | null;
  buyerGstin?: string | null;
  branding: PlatformBranding;
};

const DOC_LABEL: Record<string, string> = {
  quotation: "QUOTATION",
  proforma: "PROFORMA INVOICE",
  tax_invoice: "TAX INVOICE",
  renewal_invoice: "RENEWAL INVOICE",
  credit_note: "CREDIT NOTE",
  payment_receipt: "PAYMENT RECEIPT",
};

function rs(minor: number | null | undefined): string {
  return `₹${((minor ?? 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function buildPlatformBillingPdf(input: PlatformBillingPdfInput): jsPDF {
  const { doc, buyerName, buyerAddress, buyerGstin, branding } = input;
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const margin = 14;
  let y = margin;

  const docTitle = DOC_LABEL[doc.document_type] ?? doc.document_type.toUpperCase();
  const isInterState = (doc.igst_minor ?? 0) > 0;
  const gstRate = doc.data?.gst_rate_percent ?? 0;
  const description = doc.data?.description || DOC_LABEL[doc.document_type] || doc.document_type;

  // Logo
  if (branding.logoDataUrl) {
    try {
      pdf.addImage(branding.logoDataUrl, "PNG", margin, y, 28, 14);
    } catch {
      /* skip invalid logo */
    }
  }

  // Seller block
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(20, 20, 20);
  pdf.text(branding.companyName, margin + (branding.logoDataUrl ? 32 : 0), y + 4);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  let sellerY = y + 9;
  const sellerX = margin + (branding.logoDataUrl ? 32 : 0);
  if (branding.address) {
    for (const line of branding.address.split("\n").slice(0, 3)) {
      pdf.text(line.trim(), sellerX, sellerY);
      sellerY += 3.5;
    }
  }
  if (branding.gstin) {
    pdf.text(`GSTIN: ${branding.gstin}`, sellerX, sellerY);
    sellerY += 3.5;
  }
  if (branding.email) {
    pdf.text(branding.email, sellerX, sellerY);
    sellerY += 3.5;
  }
  if (branding.phone) {
    pdf.text(branding.phone, sellerX, sellerY);
  }

  // Document meta (right)
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text(docTitle, pageW - margin, y + 4, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text(`No: ${doc.document_no}`, pageW - margin, y + 10, { align: "right" });
  pdf.text(`Date: ${fmtDate(doc.issued_at)}`, pageW - margin, y + 14, { align: "right" });
  if (doc.due_at) {
    pdf.text(`Due: ${fmtDate(doc.due_at)}`, pageW - margin, y + 18, { align: "right" });
  }
  pdf.text(`Status: ${(doc.status ?? "draft").toUpperCase()}`, pageW - margin, y + 22, {
    align: "right",
  });

  y = Math.max(sellerY, y + 24) + 6;
  pdf.setDrawColor(180, 180, 180);
  pdf.line(margin, y, pageW - margin, y);
  y += 6;

  // Bill to
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(100, 100, 100);
  pdf.text("BILL TO", margin, y);
  y += 4;
  pdf.setTextColor(20, 20, 20);
  pdf.setFontSize(10);
  pdf.text(buyerName, margin, y);
  y += 4;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  if (buyerAddress) {
    for (const line of buyerAddress.split("\n").slice(0, 4)) {
      pdf.text(line.trim(), margin, y);
      y += 3.5;
    }
  }
  if (buyerGstin) {
    pdf.text(`GSTIN: ${buyerGstin}`, margin, y);
    y += 4;
  }

  y += 4;

  // Table header
  const colDesc = margin;
  const colAmt = pageW - margin;
  pdf.setFillColor(245, 245, 245);
  pdf.rect(margin, y, pageW - margin * 2, 7, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("Description", colDesc + 2, y + 4.5);
  pdf.text("Amount", colAmt - 2, y + 4.5, { align: "right" });
  y += 9;

  pdf.setFont("helvetica", "normal");
  pdf.text(description.slice(0, 90), colDesc + 2, y + 3);
  pdf.text(rs(doc.taxable_minor), colAmt - 2, y + 3, { align: "right" });
  y += 10;

  // Totals (right column)
  const totalsX = pageW - margin - 52;
  const totalsValX = pageW - margin;
  pdf.setFontSize(8);
  const addTotalLine = (label: string, value: string, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.text(label, totalsX, y);
    pdf.text(value, totalsValX, y, { align: "right" });
    y += 4.5;
  };

  addTotalLine("Taxable Subtotal", rs(doc.taxable_minor));
  if (isInterState) {
    addTotalLine(`IGST (${gstRate}%)`, rs(doc.igst_minor));
  } else {
    addTotalLine(`CGST (${gstRate / 2}%)`, rs(doc.cgst_minor));
    addTotalLine(`SGST (${gstRate / 2}%)`, rs(doc.sgst_minor));
  }
  y += 1;
  pdf.line(totalsX, y, totalsValX, y);
  y += 4;
  addTotalLine("Grand Total", rs(doc.amount_minor), true);
  const paid = doc.paid_minor ?? 0;
  const balance = (doc.amount_minor ?? 0) - paid;
  addTotalLine("Amount Paid", rs(paid));
  addTotalLine("Balance Due", rs(balance), true);

  // Footer
  y = pdf.internal.pageSize.getHeight() - 16;
  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(7);
  pdf.setTextColor(120, 120, 120);
  pdf.text("This is a system-generated document for AVS Gold ERP platform billing.", margin, y);
  pdf.text(`Generated ${new Date().toLocaleString("en-IN")}`, margin, y + 3.5);

  return pdf;
}

export async function downloadPlatformBillingPdf(
  input: PlatformBillingPdfInput,
  filename?: string,
): Promise<void> {
  const pdf = buildPlatformBillingPdf(input);
  const name =
    filename ??
    `${input.doc.document_no || "document"}-${input.doc.document_type || "billing"}.pdf`;
  pdf.save(name);
}

export function printPlatformBillingPdf(input: PlatformBillingPdfInput): void {
  const pdf = buildPlatformBillingPdf(input);
  pdf.autoPrint();
  const blobUrl = pdf.output("bloburl");
  const win = window.open(blobUrl, "_blank");
  if (!win) {
    void downloadPlatformBillingPdf(input);
  }
}
