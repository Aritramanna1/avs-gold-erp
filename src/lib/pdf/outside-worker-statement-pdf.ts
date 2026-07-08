/**
 * Outside Worker Statement — PDF Engine.
 *
 * Self-contained (own layout helpers), mirroring job-card-pdf.ts's approach
 * rather than reusing document-pdf-generator.ts's A4 invoice helpers — this
 * is a different document family (a ledger statement, not a billing
 * document) and must not risk any change to Billing/Order printing.
 *
 * Supports four statement kinds (see StatementKind) — the caller
 * (outside-work-statement.ts) decides which transactions/charges/payments/
 * settlements fall inside the requested period; this file only renders
 * whatever it's handed.
 */
import { jsPDF } from "jspdf";
import type { FirmProfile } from "@/lib/settings-store";
import { mgToGrams } from "@/lib/gold";
import { paiseToRupees } from "@/lib/orders-store";
import type { OutsideWorkStatementData } from "@/lib/outside-work-statement";

const MARGIN = 15;
const PAGE_W = 210; // A4 portrait, mm
const CONTENT_W = PAGE_W - MARGIN * 2;
const COL_R = PAGE_W - MARGIN;

function fmtDate(ts: number | string): string {
  const d = typeof ts === "number" ? new Date(ts) : new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function hrule(doc: jsPDF, y: number): number {
  doc.setDrawColor(190, 180, 165);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, COL_R, y);
  return y + 4;
}

function ensureSpace(doc: jsPDF, y: number, needed = 8): number {
  if (y + needed > 285) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

const KIND_LABELS: Record<OutsideWorkStatementData["kind"], string> = {
  date_range: "Statement",
  monthly: "Monthly Statement",
  outstanding: "Outstanding Statement",
  settlement: "Settlement Statement",
};

/**
 * Renders a Outside Worker statement as a multi-page A4 PDF. Returns a
 * Blob — caller decides preview vs. download (matches job-card-pdf.ts's
 * convention).
 */
export async function generateOutsideWorkerStatementPdf(
  data: OutsideWorkStatementData,
  firm: FirmProfile,
): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  doc.text(firm.shopName || "Jewellers ERP", MARGIN, y);
  doc.setFontSize(12);
  doc.text(KIND_LABELS[data.kind], COL_R, y, { align: "right" });
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 80, 70);
  doc.text(`Outside Jeweller: ${data.jewellerName}`, MARGIN, y);
  doc.text(`Period: ${data.periodLabel}`, COL_R, y, { align: "right" });
  y += 4;
  doc.text(`Generated: ${fmtDate(Date.now())}`, MARGIN, y);
  y = hrule(doc, y + 3);

  // ── Position summary ──────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text("Current Position", MARGIN, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const summaryRows: [string, string][] = [
    ["Pending Gold (fine)", `${mgToGrams(data.position.pendingGoldFineMg)} g`],
    ["Pending Material (gross)", `${mgToGrams(data.position.pendingMaterialGrossMg)} g`],
    ["Total Labour Billed", `Rs. ${paiseToRupees(data.labourPosition.totalBilledPaise)}`],
    ["Total Paid", `Rs. ${paiseToRupees(data.labourPosition.totalPaidPaise)}`],
    ["Labour Outstanding", `Rs. ${paiseToRupees(data.labourPosition.outstandingPaise)}`],
  ];
  for (const [label, value] of summaryRows) {
    y = ensureSpace(doc, y);
    doc.text(label, MARGIN, y);
    doc.text(value, COL_R, y, { align: "right" });
    y += 5;
  }
  y = hrule(doc, y + 1);

  // ── Gold transactions ─────────────────────────────────────────────────
  if (data.transactions.length > 0) {
    y = ensureSpace(doc, y, 10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Gold / Material Transactions", MARGIN, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    for (const t of data.transactions) {
      y = ensureSpace(doc, y);
      const line = `${fmtDate(t.ts)}  ${t.type === "issue" ? "Issued" : "Received"}  ${t.materialType}  ${mgToGrams(t.grossMg)} g`;
      doc.text(line, MARGIN, y);
      y += 4.5;
    }
    y = hrule(doc, y + 1);
  }

  // ── Labour charges ────────────────────────────────────────────────────
  if (data.labourCharges.length > 0) {
    y = ensureSpace(doc, y, 10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Labour Charges", MARGIN, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    for (const c of data.labourCharges) {
      y = ensureSpace(doc, y);
      const line = `${fmtDate(c.ts)}  ${c.billNumber ?? "—"}  ${c.calculationMethod}  Rs. ${paiseToRupees(c.totalPaise)}${c.approved ? "" : "  (pending approval)"}`;
      doc.text(line, MARGIN, y);
      y += 4.5;
    }
    y = hrule(doc, y + 1);
  }

  // ── Payments ──────────────────────────────────────────────────────────
  if (data.payments.length > 0) {
    y = ensureSpace(doc, y, 10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Payments", MARGIN, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    for (const p of data.payments) {
      y = ensureSpace(doc, y);
      const line = `${fmtDate(p.ts)}  ${p.mode}  Rs. ${paiseToRupees(p.amountPaise)}${p.reference ? `  Ref ${p.reference}` : ""}`;
      doc.text(line, MARGIN, y);
      y += 4.5;
    }
    y = hrule(doc, y + 1);
  }

  // ── Settlements ───────────────────────────────────────────────────────
  if (data.settlements.length > 0) {
    y = ensureSpace(doc, y, 10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Settlement History", MARGIN, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    for (const s of data.settlements) {
      y = ensureSpace(doc, y);
      const kind = s.settlement_type === "outside_work_gold_settlement" ? "Gold" : "Labour";
      const line = `${fmtDate(s.settlement_date)}  ${kind}  Rs. ${paiseToRupees(s.amount_paise)}`;
      doc.text(line, MARGIN, y);
      y += 4.5;
    }
  }

  return doc.output("blob");
}

/** Derives a filesystem-safe download filename for an Outside Worker statement. */
export function outsideWorkerStatementFileName(
  data: OutsideWorkStatementData,
  firm: FirmProfile,
): string {
  const shop = (firm.shopName || "ERP").replace(/\s+/g, "_");
  const safeJeweller = data.jewellerName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeKind = data.kind;
  return `${shop}_OutsideWork_${safeJeweller}_${safeKind}.pdf`;
}
