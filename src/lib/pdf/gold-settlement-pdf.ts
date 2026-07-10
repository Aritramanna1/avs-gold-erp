/**
 * Gold Settlement Voucher — PDF Engine.
 *
 * Self-contained on purpose, same convention job-card-pdf.ts already
 * established: it does not import document-pdf-generator.ts's internal
 * table/header helpers, so nothing here can ever risk a change to
 * Invoice/Order/Repair/Manufacturing Bill printing. A Gold Settlement
 * Voucher is its own document type with its own 12-column layout (weight,
 * touch, wastage, gold, amount) that no other document needs.
 *
 * Renders the same content the on-screen print preview
 * (billing.gold-settlement-print.$id.tsx) shows — this just gives a
 * downloadable file independent of the browser's print dialog.
 */
import { jsPDF } from "jspdf";
import type { FirmProfile } from "@/lib/settings-store";
import type { GoldSettlementRecord } from "@/lib/supabase-services";
import { mgToGrams } from "@/lib/gold";

const MARGIN = 12;
const PAGE_W = 210; // A4 portrait, mm
const CONTENT_W = PAGE_W - MARGIN * 2;
const COL_R = PAGE_W - MARGIN;

function paiseToRs(p: number): string {
  return (p / 100).toFixed(2);
}

function fmtDate(d: string | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
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
  rowHeight = 8,
): number {
  const headerH = 7;

  doc.setFillColor(245, 240, 228);
  doc.rect(MARGIN, startY, CONTENT_W, headerH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(50, 40, 20);
  let colX = MARGIN;
  for (const col of columns) {
    const textX = col.align === "right" ? colX + col.width - 1.5 : colX + 1.5;
    doc.text(col.header, textX, startY + 4.7, { align: col.align === "right" ? "right" : "left" });
    colX += col.width;
  }
  doc.setDrawColor(120, 113, 108);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN, startY, CONTENT_W, headerH);

  let y = startY + headerH;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (i % 2 === 1) {
      doc.setFillColor(252, 250, 246);
      doc.rect(MARGIN, y, CONTENT_W, rowHeight, "F");
    }
    colX = MARGIN;
    for (const col of columns) {
      const val = row[col.key] ?? "";
      const textX = col.align === "right" ? colX + col.width - 1.5 : colX + 1.5;
      const lines = doc.splitTextToSize(val, col.width - 3);
      doc.text(lines[0] ?? "", textX, y + 5, { align: col.align === "right" ? "right" : "left" });
      colX += col.width;
    }
    doc.setDrawColor(210, 200, 190);
    doc.line(MARGIN, y + rowHeight, COL_R, y + rowHeight);
    y += rowHeight;
  }

  doc.setDrawColor(120, 113, 108);
  doc.rect(MARGIN, startY, CONTENT_W, y - startY);
  return y + 5;
}

function balanceBlock(
  doc: jsPDF,
  title: string,
  x: number,
  y: number,
  w: number,
  lines: { label: string; value: string; bold?: boolean }[],
): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(80, 60, 30);
  doc.text(title.toUpperCase(), x, y);
  doc.setDrawColor(190, 180, 165);
  doc.setLineWidth(0.2);
  doc.line(x, y + 1.5, x + w, y + 1.5);
  let ly = y + 6;
  for (const line of lines) {
    doc.setFont("helvetica", line.bold ? "bold" : "normal");
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(line.label, x, ly);
    doc.text(line.value, x + w, ly, { align: "right" });
    ly += 5;
  }
  return ly + 2;
}

/**
 * Renders one Gold Settlement Voucher as a single A4 page. Returns the PDF
 * as a Blob — callers decide whether to trigger a download or hand it to
 * the shared print-queue.
 */
export function generateGoldSettlementPdf(
  settlement: GoldSettlementRecord,
  partyName: string,
  firm: FirmProfile,
): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;

  // ── Header ──────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  doc.text(firm.shopName || "Jewellers ERP", MARGIN, y + 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("GOLD PAYMENT VOUCHER", COL_R, y + 6, { align: "right" });
  y += 11;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 80, 70);
  doc.text(`Voucher No: ${settlement.id}`, MARGIN, y);
  doc.text(`Date: ${fmtDate(settlement.settlement_date)}`, COL_R, y, { align: "right" });
  y += 5;
  doc.text(`Party: ${partyName}`, MARGIN, y);
  if (settlement.payment_mode) {
    doc.text(`Payment Mode: ${settlement.payment_mode}`, COL_R, y, { align: "right" });
  }
  y += 4;
  doc.setDrawColor(120, 113, 108);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, COL_R, y);
  y += 6;

  // ── Items table ───────────────────────────────────────────────────────────
  const itemsList: any[] = settlement.items ?? [];
  const columns: TableColumn[] = [
    { header: "Particulars", key: "description", width: 34 },
    { header: "HUID", key: "huid", width: 12, align: "center" },
    { header: "Stamp", key: "stamp", width: 10, align: "center" },
    { header: "G.Wt", key: "gross", width: 13, align: "right" },
    { header: "Add", key: "add", width: 11, align: "right" },
    { header: "Less", key: "less", width: 11, align: "right" },
    { header: "Net Wt", key: "net", width: 13, align: "right" },
    { header: "Touch", key: "purity", width: 10, align: "center" },
    { header: "Wstg", key: "wastage", width: 10, align: "center" },
    { header: "Pcs", key: "pcs", width: 7, align: "center" },
    { header: "Labour", key: "labour", width: 13, align: "right" },
    { header: "Gold", key: "gold", width: 13, align: "right" },
    { header: "Amount", key: "amount", width: 13, align: "right" },
  ];
  const rows = itemsList.map((it) => ({
    description: `${it.description ?? ""} (${it.direction === "Jama" ? "Jama" : "Naam"})`,
    huid: it.huid || "—",
    stamp: it.stamp || "—",
    gross: it.grossGrams ? it.grossGrams.toFixed(3) : "—",
    add: it.addGrams ? it.addGrams.toFixed(3) : "—",
    less: it.lessGrams ? it.lessGrams.toFixed(3) : "—",
    net: it.netGrams ? it.netGrams.toFixed(3) : "—",
    purity: it.purity ? `${it.purity}%` : "—",
    wastage: it.wastagePct ? `${it.wastagePct}%` : "—",
    pcs: it.pcs ? String(it.pcs) : "—",
    labour: it.labourRupees ? `₹${it.labourRupees}` : "—",
    gold: it.fineGrams ? `${it.fineGrams.toFixed(3)}g` : "—",
    amount: it.amountRupees ? `₹${it.amountRupees}` : "—",
  }));
  y = addTable(doc, columns, rows, y);

  // ── Balances (Gold + Cash side by side) ──────────────────────────────────
  const prevGoldMg = settlement.p_balance_gold_mg ?? 0;
  const prevCashPaise = settlement.p_balance_cash_paise ?? 0;
  const todayGoldJama = itemsList
    .filter((it) => it.kind === "gold" && it.direction === "Jama")
    .reduce((s, it) => s + (it.fineGrams || 0), 0);
  const todayGoldNaam = itemsList
    .filter((it) => it.kind === "gold" && it.direction === "Naam")
    .reduce((s, it) => s + (it.fineGrams || 0), 0);
  const todayCashJama = itemsList
    .filter((it) => it.direction === "Jama")
    .reduce((s, it) => s + (it.kind === "cash" ? it.amountRupees || 0 : it.labourRupees || 0), 0);
  const todayCashNaam = itemsList
    .filter((it) => it.direction === "Naam")
    .reduce(
      (s, it) =>
        s +
        (it.kind === "cash"
          ? it.amountRupees || 0
          : (it.amountRupees || 0) + (it.labourRupees || 0)),
      0,
    );
  const itemNetGoldMg =
    prevGoldMg +
    Math.round(
      itemsList
        .filter((it) => it.kind === "gold" && it.rowType === "item")
        .reduce((s, it) => s + (it.direction === "Jama" ? 1 : -1) * (it.fineGrams || 0), 0) * 1000,
    );
  const itemNetCashPaise =
    prevCashPaise +
    Math.round(
      itemsList
        .filter((it) => it.rowType === "item")
        .reduce((s, it) => {
          const val = it.kind === "cash" ? it.amountRupees || 0 : it.labourRupees || 0;
          return s + (it.direction === "Jama" ? 1 : -1) * val;
        }, 0) * 100000,
    );
  const closingGoldMg = prevGoldMg + Math.round((todayGoldJama - todayGoldNaam) * 1000);
  const closingCashPaise = prevCashPaise + Math.round((todayCashJama - todayCashNaam) * 100000);

  const halfW = CONTENT_W / 2 - 4;
  const goldY = balanceBlock(doc, "Gold Statement (Fine equivalent)", MARGIN, y, halfW, [
    {
      label: "Previous Balance",
      value: `${mgToGrams(Math.abs(prevGoldMg))}g ${prevGoldMg >= 0 ? "Jama" : "Naam"}`,
    },
    { label: "Today Jama (+)", value: `+${todayGoldJama.toFixed(3)}g` },
    { label: "Today Naam (-)", value: `-${todayGoldNaam.toFixed(3)}g` },
    {
      label: "Net Total",
      value: `${mgToGrams(Math.abs(itemNetGoldMg))}g ${itemNetGoldMg >= 0 ? "Jama" : "Naam"}`,
    },
    {
      label: "Closing Balance",
      value: `${mgToGrams(Math.abs(closingGoldMg))}g ${closingGoldMg >= 0 ? "Jama" : "Naam"}`,
      bold: true,
    },
  ]);

  const cashY = balanceBlock(doc, "Rupees / Cash Statement", MARGIN + halfW + 8, y, halfW, [
    {
      label: "Previous Balance",
      value: `₹${paiseToRs(Math.abs(prevCashPaise))} ${prevCashPaise >= 0 ? "Jama" : "Naam"}`,
    },
    { label: "Today Jama (+)", value: `+₹${todayCashJama}` },
    { label: "Today Naam (-)", value: `-₹${todayCashNaam}` },
    {
      label: "Net Total",
      value: `₹${paiseToRs(Math.abs(itemNetCashPaise))} ${itemNetCashPaise >= 0 ? "Jama" : "Naam"}`,
    },
    {
      label: "Closing Balance",
      value: `₹${paiseToRs(Math.abs(closingCashPaise))} ${closingCashPaise >= 0 ? "Jama" : "Naam"}`,
      bold: true,
    },
  ]);
  y = Math.max(goldY, cashY);

  if (settlement.p_balance_ref_voucher_id) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(120, 110, 100);
    doc.text(
      `LB Bal. carried forward from voucher #${settlement.p_balance_ref_voucher_id} · ${fmtDate(settlement.p_balance_ref_voucher_date)}`,
      MARGIN,
      y,
    );
    y += 5;
  }

  const cleanNotes = settlement.notes?.split("[Voucher Action:")[0]?.trim();
  if (cleanNotes) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(90, 80, 70);
    const lines = doc.splitTextToSize(`Memo: ${cleanNotes}`, CONTENT_W);
    doc.text(lines, MARGIN, y + 3);
    y += 3 + lines.length * 4;
  }

  // ── Signatures ────────────────────────────────────────────────────────────
  const footerY = Math.max(y + 14, 270);
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, footerY, MARGIN + 50, footerY);
  doc.line(COL_R - 50, footerY, COL_R, footerY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text("Recipient Signature", MARGIN, footerY + 4);
  doc.text("Authorised Signature", COL_R - 50, footerY + 4);

  return doc.output("blob");
}

/** Derives a filesystem-safe download filename for a Gold Settlement Voucher PDF. */
export function goldSettlementPdfFileName(
  settlement: GoldSettlementRecord,
  firm: FirmProfile,
): string {
  const safe = settlement.id.replace(/[^a-zA-Z0-9_-]/g, "_");
  const shop = (firm.shopName || "ERP").replace(/\s+/g, "_");
  return `${shop}_GoldVoucher_${safe}.pdf`;
}
