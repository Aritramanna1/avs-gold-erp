/**
 * Digital Job Card — PDF Engine.
 *
 * Self-contained on purpose: it does not share layout helpers with
 * document-pdf-generator.ts (Invoice/Order/Repair/Manufacturing Bill),
 * because those are tuned for full A4 pages and this must not risk any
 * change to Billing/Order/Repair/Manufacturing printing. A Job Card is a
 * half-page (A5) document by design — minimal paper, one card per sheet
 * half — so it gets its own compact layout instead of reusing/shrinking
 * the A4 helpers.
 *
 * This is the SINGLE Job Card engine: every future job card (this phase's
 * Production-Order-only card, and later phases once Material Issue / Gold
 * Issue exist) should render through `generateJobCardPdf()` so every job
 * card a shop ever prints looks the same.
 */
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import type { FirmProfile } from "@/lib/settings-store";
import type { JobCardPrintData } from "@/lib/job-card-engine";

const MARGIN = 8;
const PAGE_W = 148; // A5 portrait, mm — half an A4 sheet
const PAGE_H = 210;
const CONTENT_W = PAGE_W - MARGIN * 2;
const COL_R = PAGE_W - MARGIN;

function mgToG(mg: number): string {
  return (mg / 1000).toFixed(3);
}

function purityLabel(p: number): string {
  if (p >= 990) return "999 (24K)";
  if (p >= 915) return "916 (22K)";
  if (p >= 749) return "750 (18K)";
  if (p >= 584) return "585 (14K)";
  return `${p}`;
}

function fmtDate(d: number | string | undefined): string {
  if (!d) return "—";
  const date = typeof d === "number" ? new Date(d) : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

async function qrDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 300,
    color: { dark: "#000000", light: "#FFFFFFFF" },
  });
}

function field(doc: jsPDF, label: string, value: string, x: number, y: number, w: number): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(110, 100, 90);
  doc.text(label.toUpperCase(), x, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(20, 20, 20);
  const lines = doc.splitTextToSize(value || "—", w);
  doc.text(lines, x, y + 4);
  return y + 4 + lines.length * 4;
}

function hrule(doc: jsPDF, y: number): number {
  doc.setDrawColor(190, 180, 165);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, COL_R, y);
  return y + 4;
}

/**
 * Renders one Job Card as a single A5 page. Returns the PDF as a Blob —
 * callers decide whether to open it in a preview iframe, trigger a
 * download, or (a future phase) hand it to the shared print-queue.
 */
export async function generateJobCardPdf(data: JobCardPrintData, firm: FirmProfile): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: [PAGE_W, PAGE_H] });
  let y = MARGIN;

  // ── Header ──────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text(firm.shopName || "Jewellers ERP", MARGIN, y + 5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("JOB CARD", COL_R, y + 5, { align: "right" });
  y += 9;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90, 80, 70);
  doc.text(`Job Card No: ${data.jobCardNo}`, MARGIN, y);
  doc.text(`Date: ${fmtDate(data.generatedAt)}`, COL_R, y, { align: "right" });
  y += 4;
  doc.text(`Production Order: ${data.productionOrderNo}`, MARGIN, y);
  y += 3;
  y = hrule(doc, y + 2);

  // ── QR code (top-right block) ────────────────────────────────────────────
  const qrSize = 22;
  try {
    const qr = await qrDataUrl(data.qrPayload);
    doc.addImage(qr, "PNG", COL_R - qrSize, y, qrSize, qrSize);
  } catch {
    // QR generation must never block printing the card itself.
  }

  // ── Customer / Item block (left column, alongside QR) ───────────────────
  const leftW = CONTENT_W - qrSize - 4;
  let ly = y + 3;
  ly = field(
    doc,
    "Customer / Dealer",
    data.customerName + (data.customerPhone ? `  (${data.customerPhone})` : ""),
    MARGIN,
    ly,
    leftW,
  );
  ly = field(doc, "Product Name", data.itemName, MARGIN, ly + 1, leftW);
  ly = field(
    doc,
    "Assigned Worker",
    data.assignedWorkerName || "Unassigned",
    MARGIN,
    ly + 1,
    leftW,
  );

  y = Math.max(ly, y + qrSize) + 3;
  y = hrule(doc, y);

  // ── Product Description ──────────────────────────────────────────────────
  y = field(doc, "Product Description", data.itemDescription || "—", MARGIN, y, CONTENT_W);
  y = hrule(doc, y + 3);

  // ── Weight / Purity / Gold Received grid (3 columns) ─────────────────────
  const colW = CONTENT_W / 3;
  const rowTopY = y;
  field(doc, "Target Weight (Net)", `${mgToG(data.targetNetMg)} g`, MARGIN, rowTopY, colW - 2);
  field(doc, "Purity", purityLabel(data.purity), MARGIN + colW, rowTopY, colW - 2);
  field(
    doc,
    "Gold Received",
    data.goldReceivedFineMg > 0 ? `${mgToG(data.goldReceivedFineMg)} g fine` : "None",
    MARGIN + colW * 2,
    rowTopY,
    colW - 2,
  );
  y = rowTopY + 10;
  y = hrule(doc, y);

  y = field(
    doc,
    "Target Gross Weight",
    `${mgToG(data.targetGrossMg)} g`,
    MARGIN,
    y,
    CONTENT_W / 2 - 2,
  );
  y = hrule(doc, y + 1);

  y = field(doc, "Expected Delivery Date", fmtDate(data.expectedDelivery), MARGIN, y, CONTENT_W);
  y = hrule(doc, y + 3);

  // ── Reference Images ──────────────────────────────────────────────────────
  if (data.referenceImages.length > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(110, 100, 90);
    doc.text("REFERENCE IMAGE(S)", MARGIN, y);
    y += 2;
    const imgSize = Math.min(28, (CONTENT_W - 6) / Math.min(data.referenceImages.length, 4));
    let ix = MARGIN;
    for (const img of data.referenceImages.slice(0, 4)) {
      try {
        doc.addImage(img, ix, y, imgSize, imgSize);
      } catch {
        // A single bad/corrupt image must not break the whole card.
      }
      ix += imgSize + 3;
    }
    y += imgSize + 4;
    y = hrule(doc, y);
  }

  // ── Remarks ────────────────────────────────────────────────────────────
  y = field(doc, "Remarks", data.remarks || "—", MARGIN, y, CONTENT_W);

  // ── Footer — signature lines, pinned near the bottom of the half-page ───
  const footerY = PAGE_H - MARGIN - 10;
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, footerY, MARGIN + 40, footerY);
  doc.line(COL_R - 40, footerY, COL_R, footerY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(90, 90, 90);
  doc.text("Issued By", MARGIN, footerY + 4);
  doc.text("Worker Acknowledgement", COL_R - 40, footerY + 4);

  return doc.output("blob");
}

/** Derives a filesystem-safe download filename for a Job Card PDF. */
export function jobCardFileName(data: JobCardPrintData, firm: FirmProfile): string {
  const safe = data.jobCardNo.replace(/[^a-zA-Z0-9_-]/g, "_");
  const shop = (firm.shopName || "ERP").replace(/\s+/g, "_");
  return `${shop}_JobCard_${safe}.pdf`;
}
