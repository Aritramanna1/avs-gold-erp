/**
 * Unified Print Engine — shared jsPDF drawing primitives.
 *
 * Generalizes what document-pdf-generator.ts, gold-settlement-pdf.ts,
 * job-card-pdf.ts and outside-worker-statement-pdf.ts each currently
 * hand-roll independently (confirmed: zero shared code between the four
 * today) into one toolkit driven by the same SectionConfig/
 * PrintDocumentData shapes the screen renderer uses — one definition of
 * "what a table/balance-card/signature-block looks like," not four.
 * Still jsPDF-native (no html2canvas/Puppeteer), proven in the browser print path.
 *
 * Geometry is computed per-document from the actual jsPDF page size
 * (Geometry, below) rather than hardcoded A4 constants — the original
 * Phase 0 version hardcoded PAGE_W=210, which drew every PDF as if it
 * were A4 regardless of the document's real paper size. That never
 * surfaced while only credit_note (a4-only) used this path; migrating
 * the GST invoice (a4/a5/thermal80/thermal58/tag) would have shipped a5+
 * PDFs with content running off the page, and thermal/tag PDFs almost
 * entirely off-page. Fixed once here for every doc type, not per-document.
 */
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import type { FirmProfile } from "@/lib/settings-store";
import {
  resolveFirmAssetPreviewUrl,
  shouldRenderAuthorizedSignature,
  shouldRenderPrintStamp,
} from "@/lib/print-engine/print-branding";
import { urlToPdfImageData } from "@/lib/print-engine/attachment-images";
import type {
  BalanceCardSectionConfig,
  BilledToStampSectionConfig,
  DataListSectionConfig,
  FieldGridSectionConfig,
  PremiumHeaderSectionConfig,
  PrintDocumentData,
  PrintSize,
  RichTextSectionConfig,
  SignatureBlockSectionConfig,
  TableSectionConfig,
  TagCardsSectionConfig,
  ThermalItemListSectionConfig,
} from "@/lib/print-engine/types";
import { formatFieldValue, getPath, isVisible } from "@/lib/print-engine/resolve";

export interface Geometry {
  margin: number;
  pageW: number;
  contentW: number;
  colR: number;
}

const MARGIN_BY_SIZE: Record<PrintSize, number> = {
  a4: 15,
  a5: 12,
  a5l: 10,
  a6: 10,
  thermal: 3,
  thermal58: 2,
  tag: 2,
};

/** `marginOverrideMm` — the user's page-setup margin (see print-setup-store); the size's default when absent. */
export function geometryFor(doc: jsPDF, paperSize: PrintSize, marginOverrideMm?: number): Geometry {
  const margin = marginOverrideMm ?? MARGIN_BY_SIZE[paperSize];
  const pageW = doc.internal.pageSize.getWidth();
  const contentW = pageW - margin * 2;
  return { margin, pageW, contentW, colR: pageW - margin };
}

export async function addDocHeader(
  doc: jsPDF,
  geo: Geometry,
  firm: FirmProfile,
  docTitle: string,
  docNo: string,
  date: string,
): Promise<number> {
  const { margin, colR } = geo;
  const y0 = margin;

  let textStartX = margin;
  if (firm.logoUrl) {
    try {
      const logoImg = await urlToPdfImageData(firm.logoUrl);
      if (logoImg) {
        const maxW = 16;
        const maxH = 14;
        const aspect = logoImg.aspectRatio || (logoImg.width && logoImg.height ? logoImg.width / logoImg.height : 1);
        let renderW = maxW;
        let renderH = renderW / aspect;
        if (renderH > maxH) {
          renderH = maxH;
          renderW = renderH * aspect;
        }
        const imgOffY = y0 + 1 + (maxH - renderH) / 2;
        doc.addImage(
          logoImg.dataUrl,
          logoImg.format === "WEBP" ? "JPEG" : logoImg.format,
          margin,
          imgOffY,
          renderW,
          renderH,
        );
        textStartX = margin + renderW + 4;
      }
    } catch {
      // Logo rendering failed; continue without it
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(firm.shopName || "Jewellers ERP", textStartX, y0 + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  let addrY = y0 + 12;
  if (firm.address) {
    doc.text(firm.address, textStartX, addrY);
    addrY += 4;
  }
  if (firm.gstin) {
    doc.text(`GSTIN: ${firm.gstin}`, textStartX, addrY);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text((docTitle || "DOCUMENT").toUpperCase(), colR, y0 + 6, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (docNo) {
    doc.text(`No: ${docNo}`, colR, y0 + 12, { align: "right" });
  }
  doc.text(`Date: ${date}`, colR, y0 + 17, { align: "right" });

  const ruleY = y0 + 24;
  doc.setDrawColor(120, 113, 108);
  doc.setLineWidth(0.5);
  doc.line(margin, ruleY, colR, ruleY);
  return ruleY + 5;
}

export async function addPremiumHeader(
  doc: jsPDF,
  geo: Geometry,
  config: PremiumHeaderSectionConfig,
  data: PrintDocumentData,
  firm: FirmProfile,
  y: number,
): Promise<number> {
  const { margin, colR } = geo;
  const badgeTitle = formatFieldValue(getPath(data.fields, config.badgeTitlePath ?? ""));
  const dateLabel = data.createdAt
    ? new Date(data.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })
    : "";

  if (config.variant === "compact") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(firm.shopName || "Jewellers ERP", geo.pageW / 2, y + 4, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    let ry = y + 8;
    if (firm.address) {
      doc.text(firm.address.slice(0, 48), geo.pageW / 2, ry, { align: "center" });
      ry += 3.5;
    }
    if (firm.phone) {
      doc.text(`Mob: ${firm.phone}`, geo.pageW / 2, ry, { align: "center" });
      ry += 3.5;
    }
    if (firm.gstin) {
      doc.text(`GST: ${firm.gstin}`, geo.pageW / 2, ry, { align: "center" });
      ry += 3.5;
    }
    return ry + 2;
  }

  let textStartX = margin;
  if (firm.logoUrl) {
    try {
      const logoImg = await urlToPdfImageData(firm.logoUrl);
      if (logoImg) {
        const maxW = 16;
        const maxH = 14;
        const aspect = logoImg.aspectRatio || (logoImg.width && logoImg.height ? logoImg.width / logoImg.height : 1);
        let renderW = maxW;
        let renderH = renderW / aspect;
        if (renderH > maxH) {
          renderH = maxH;
          renderW = renderH * aspect;
        }
        const imgOffY = y + 1 + (maxH - renderH) / 2;
        doc.addImage(
          logoImg.dataUrl,
          logoImg.format === "WEBP" ? "JPEG" : logoImg.format,
          margin,
          imgOffY,
          renderW,
          renderH,
        );
        textStartX = margin + renderW + 4;
      }
    } catch {
      // Logo rendering failed; continue without it
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(firm.shopName || "Jewellers ERP", textStartX, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  let addrY = y + 12;
  if (firm.address) {
    doc.text(firm.address, textStartX, addrY);
    addrY += 4;
  }
  if (firm.gstin) doc.text(`GSTIN: ${firm.gstin}`, textStartX, addrY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(badgeTitle.toUpperCase(), colR, y + 6, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Voucher No: ${data.docNumber}`, colR, y + 12, { align: "right" });
  if (dateLabel) doc.text(`Date: ${dateLabel}`, colR, y + 17, { align: "right" });

  const ruleY = y + 24;
  doc.setDrawColor(120, 113, 108);
  doc.setLineWidth(0.5);
  doc.line(margin, ruleY, colR, ruleY);
  return ruleY + 5;
}

export function sanitizePdfText(text: string): string {
  if (!text) return "";
  return String(text)
    .replace(/₹/g, "INR ")
    .replace(/\u20B9/g, "INR ")
    .replace(/≈/g, "~")
    .replace(/—/g, "-")
    .replace(/–/g, "-");
}

export function addSectionTitle(doc: jsPDF, geo: Geometry, title: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(80, 60, 30);
  doc.text(sanitizePdfText(title).toUpperCase(), geo.margin, y);
  doc.setTextColor(0, 0, 0);
  return y + 5;
}

export function addFieldGrid(
  doc: jsPDF,
  geo: Geometry,
  config: FieldGridSectionConfig,
  data: PrintDocumentData,
  y: number,
): number {
  if (!isVisible(config.showIf, data.flags)) return y;
  const { margin, colR, contentW } = geo;
  let ry = y;
  if (config.title) ry = addSectionTitle(doc, geo, config.title, ry);
  doc.setFontSize(9);

  for (const f of config.fields) {
    if (!isVisible(f.showIf, data.flags)) continue;
    const rawVal = formatFieldValue(getPath(data.fields, f.valuePath));
    const cleanVal = sanitizePdfText(rawVal);
    const cleanLabel = sanitizePdfText(f.label);

    const valLines = doc.splitTextToSize(cleanVal, contentW * 0.55);
    const labelLines = doc.splitTextToSize(`${cleanLabel}:`, contentW * 0.4);

    doc.setFont("helvetica", "normal");
    doc.text(labelLines, margin, ry);

    doc.setFont("helvetica", "bold");
    if (f.variant === "critical") doc.setTextColor(180, 40, 40);
    else if (f.variant === "warning") doc.setTextColor(150, 100, 20);
    else if (f.variant === "success") doc.setTextColor(30, 130, 76);

    doc.text(valLines, colR, ry, { align: "right" });
    doc.setTextColor(0, 0, 0);

    const lineCount = Math.max(labelLines.length, valLines.length);
    ry += lineCount * 4.5 + 2;
  }
  return ry + 2;
}

export function addTable(
  doc: jsPDF,
  geo: Geometry,
  config: TableSectionConfig,
  data: PrintDocumentData,
  y: number,
): number {
  if (!isVisible(config.showIf, data.flags)) return y;
  const { margin, colR, contentW } = geo;
  const pageH = doc.internal.pageSize.getHeight();
  // Reserve space at the bottom for the page footer so rows never collide
  // with it — a new page is started before a row would cross this line.
  const bottomLimit = pageH - Math.min(18, pageH / 4);
  const rows = data.tables[config.rowsPath] ?? [];
  const columns = config.columns.filter(
    (c) => isVisible(c.showIf, data.flags) && c.renderAs !== "image",
  );
  let ry = y;
  if (config.title) ry = addSectionTitle(doc, geo, config.title, ry);
  if (columns.length === 0) return ry;

  const totalWeight = columns.reduce((s, c) => s + (c.width ?? 1), 0);
  const colWidths = columns.map((c) => (contentW * (c.width ?? 1)) / totalWeight);

  const headerH = 6;
  const rowHeight = 6;
  const metaH = 5;

  // Report-identity band (Name / Book / Period …) repeated on every page,
  // matching the on-screen renderer's repeating <thead> band.
  const meta = (config.repeatHeaderMeta ?? [])
    .map((m) => ({ label: m.label, value: formatFieldValue(getPath(data.fields, m.valuePath)) }))
    .filter((m) => m.value && m.value !== "—");

  /** Draws the (optional) meta band + column header at `hy`; returns the y below it. */
  const drawHead = (hy: number): number => {
    let yy = hy;
    if (meta.length > 0) {
      doc.setFillColor(250, 250, 249);
      doc.rect(margin, yy, contentW, metaH, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(90, 90, 90);
      doc.text(meta.map((m) => `${m.label}: ${m.value}`).join("    |    "), margin + 1, yy + 3.4);
      doc.setTextColor(0, 0, 0);
      doc.setDrawColor(120, 113, 108);
      doc.setLineWidth(0.3);
      doc.rect(margin, yy, contentW, metaH);
      yy += metaH;
    }
    doc.setFillColor(245, 245, 244);
    doc.rect(margin, yy, contentW, headerH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    let cx = margin + 1;
    columns.forEach((c, i) => {
      const align = c.align === "right" ? "right" : "left";
      const textX = align === "right" ? cx + colWidths[i] - 2 : cx + 1;
      doc.text(sanitizePdfText(c.header), textX, yy + 4.2, { align });
      cx += colWidths[i];
    });
    doc.setDrawColor(120, 113, 108);
    doc.setLineWidth(0.3);
    doc.rect(margin, yy, contentW, headerH);
    return yy + headerH;
  };

  let segTop = ry; // top of the current page's table segment (for its outer border)
  let rowY = drawHead(ry);
  const closeSegmentBorder = () => {
    doc.setDrawColor(120, 113, 108);
    doc.setLineWidth(0.3);
    doc.rect(margin, segTop, contentW, rowY - segTop);
  };

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  rows.forEach((row, i) => {
    // Page-break BEFORE a row that would cross the footer reserve — the row is
    // never split, and the header repeats at the top of the new page.
    if (rowY + rowHeight > bottomLimit) {
      closeSegmentBorder();
      doc.addPage();
      segTop = margin;
      rowY = drawHead(margin);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
    }
    if (i % 2 === 1) {
      doc.setFillColor(252, 252, 251);
      doc.rect(margin, rowY, contentW, rowHeight, "F");
    }
    let colX = margin + 1;
    columns.forEach((c, ci) => {
      const align = c.align === "right" ? "right" : "left";
      const textX = align === "right" ? colX + colWidths[ci] - 2 : colX + 1;
      // Multi-line cells (item description stacks) — first line only in
      // the PDF's fixed row height, matching the compact table format.
      const rawVal = formatFieldValue(row[c.key]).split("\n")[0];
      const val = sanitizePdfText(rawVal);
      const lines = doc.splitTextToSize(val, colWidths[ci] - 3);
      doc.text(lines[0] ?? "", textX, rowY + 4.2, { align });
      colX += colWidths[ci];
    });
    doc.setDrawColor(210, 200, 190);
    doc.line(margin, rowY + rowHeight, colR, rowY + rowHeight);
    rowY += rowHeight;
  });
  let colX = margin + 1;
  const footerRow = config.footerRowPath ? data.tables[config.footerRowPath]?.[0] : undefined;

  // Keep the total rows with the header on a fresh page if they'd cross the
  // footer reserve, so a statement never ends with a dangling total line.
  const totalRowsH =
    ((config.showFooterSums && rows.length > 0 ? 1 : 0) + (footerRow ? 1 : 0)) * rowHeight;
  if (totalRowsH > 0 && rowY + totalRowsH > bottomLimit) {
    closeSegmentBorder();
    doc.addPage();
    segTop = margin;
    rowY = drawHead(margin);
  }

  if (config.showFooterSums && rows.length > 0) {
    doc.setFillColor(248, 246, 240);
    doc.rect(margin, rowY, contentW, rowHeight, "F");
    doc.setFont("helvetica", "bold");
    colX = margin + 1;
    columns.forEach((c, ci) => {
      if (c.footerSum) {
        const sum = rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0);
        doc.text(String(sum), colX + colWidths[ci] - 2, rowY + 4.2, { align: "right" });
      }
      colX += colWidths[ci];
    });
    rowY += rowHeight;
  }

  if (footerRow) {
    doc.setFillColor(248, 246, 240);
    doc.rect(margin, rowY, contentW, rowHeight, "F");
    doc.setFont("helvetica", "bold");
    colX = margin + 1;
    columns.forEach((c, ci) => {
      const align = c.align === "right" ? "right" : "left";
      const textX = align === "right" ? colX + colWidths[ci] - 2 : colX + 1;
      const rawVal = formatFieldValue(footerRow[c.key]).split("\n")[0];
      doc.text(sanitizePdfText(rawVal), textX, rowY + 4.2, { align });
      colX += colWidths[ci];
    });
    rowY += rowHeight;
  }

  closeSegmentBorder();
  return rowY + 5;
}

export function addBalanceCard(
  doc: jsPDF,
  geo: Geometry,
  config: BalanceCardSectionConfig,
  data: PrintDocumentData,
  y: number,
): number {
  if (!isVisible(config.showIf, data.flags)) return y;
  const { margin, contentW } = geo;
  const gold = config.goldKey ? data.balances[config.goldKey] : undefined;
  const cash = config.cashKey ? data.balances[config.cashKey] : undefined;
  if (!gold && !cash) return y;

  let ry = y;
  if (config.title) ry = addSectionTitle(doc, geo, config.title, ry);
  const inLabel = config.labelMode === "credit_debit" ? "Credit" : "Jama (In)";
  const outLabel = config.labelMode === "credit_debit" ? "Debit" : "Naam (Out)";

  const boxW = (contentW - 6) / 2;
  const drawBox = (
    x: number,
    title: string,
    figures: { previous: number; in: number; out: number; closing: number },
  ) => {
    const boxH = 26;
    doc.setDrawColor(120, 113, 108);
    doc.setLineWidth(0.3);
    doc.rect(x, ry, boxW, boxH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(title.toUpperCase(), x + 3, ry + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const lines: [string, string][] = [
      ["Previous", String(figures.previous)],
      [inLabel, String(figures.in)],
      [outLabel, String(figures.out)],
    ];
    lines.forEach(([l, v], i) => {
      doc.text(l, x + 3, ry + 10 + i * 4.5);
      doc.text(v, x + boxW - 3, ry + 10 + i * 4.5, { align: "right" });
    });
    doc.setFont("helvetica", "bold");
    doc.text("Closing", x + 3, ry + 23.5);
    doc.text(String(figures.closing), x + boxW - 3, ry + 23.5, { align: "right" });
  };

  if (gold) drawBox(margin, "Gold", gold);
  if (cash) drawBox(margin + boxW + 6, "Cash", cash);
  return ry + 30;
}

export function addRichText(
  doc: jsPDF,
  geo: Geometry,
  config: RichTextSectionConfig,
  data: PrintDocumentData,
  y: number,
): number {
  if (!isVisible(config.showIf, data.flags)) return y;
  const text = config.textPath
    ? formatFieldValue(getPath(data.fields, config.textPath))
    : config.staticText;
  if (!text || text === "—") return y;
  let ry = y;
  if (config.title) ry = addSectionTitle(doc, geo, config.title, ry);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(config.emphasis === "plain" ? 6.5 : 8);
  const lines = doc.splitTextToSize(text, geo.contentW);
  doc.text(lines, geo.margin, ry);
  return ry + lines.length * 4 + 3;
}

export function addDataList(
  doc: jsPDF,
  geo: Geometry,
  config: DataListSectionConfig,
  data: PrintDocumentData,
  y: number,
): number {
  if (!isVisible(config.showIf, data.flags)) return y;
  const rows = data.tables[config.rowsPath] ?? [];
  if (rows.length === 0) return y;
  let ry = y;
  if (config.title) ry = addSectionTitle(doc, geo, config.title, ry);
  doc.setFontSize(7.5);
  for (const row of rows) {
    const sub =
      config.subKey && row[config.subKey] ? ` [${formatFieldValue(row[config.subKey])}]` : "";
    doc.setFont("helvetica", "normal");
    doc.text(`${formatFieldValue(row[config.labelKey])}${sub}:`, geo.margin, ry);
    doc.setFont("helvetica", "bold");
    doc.text(formatFieldValue(row[config.valueKey]), geo.colR, ry, { align: "right" });
    ry += 4;
  }
  return ry + 2;
}

export function addThermalItemList(
  doc: jsPDF,
  geo: Geometry,
  config: ThermalItemListSectionConfig,
  data: PrintDocumentData,
  y: number,
): number {
  if (!isVisible(config.showIf, data.flags)) return y;
  const rows = data.tables[config.rowsPath] ?? [];
  let ry = y;
  doc.setFontSize(7);
  for (const row of rows) {
    doc.setFont("helvetica", "bold");
    doc.text(formatFieldValue(row.itemNameShort), geo.margin, ry);
    doc.text(formatFieldValue(row.totalLabel), geo.colR, ry, { align: "right" });
    ry += 3.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.text(formatFieldValue(row.weightSummary), geo.margin, ry);
    ry += 3.5;
    doc.setFontSize(7);
  }
  return ry + 2;
}

export function addTagCards(
  doc: jsPDF,
  geo: Geometry,
  config: TagCardsSectionConfig,
  data: PrintDocumentData,
  firm: FirmProfile,
): void {
  if (!isVisible(config.showIf, data.flags)) return;
  const rows = data.tables[config.rowsPath] ?? [];
  rows.forEach((row, i) => {
    if (i > 0) doc.addPage([50, 30], "portrait");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.text(firm.shopName || "MTJ", 25, 4, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.text(formatFieldValue(row.itemName), 3, 9);
    doc.text(`GW: ${formatFieldValue(row.grossWt)}  NW: ${formatFieldValue(row.netWt)}`, 3, 13);
    doc.text(`Pty: ${formatFieldValue(row.purity)}`, 3, 17);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.text(data.docNumber, 3, 26);
    doc.text(formatFieldValue(row.totalLabel), 47, 26, { align: "right" });
  });
}

export function addBilledToStamp(
  doc: jsPDF,
  geo: Geometry,
  config: BilledToStampSectionConfig,
  data: PrintDocumentData,
  y: number,
): number {
  if (!isVisible(config.showIf, data.flags)) return y;
  return addFieldGrid(
    doc,
    geo,
    {
      type: "fieldGrid",
      id: config.id,
      title: "Billed To",
      fields: [{ label: "Name", valuePath: config.namePath }, ...config.subFields],
      showIf: config.showIf,
    },
    data,
    y,
  );
}

export async function addSignatureBlock(
  doc: jsPDF,
  geo: Geometry,
  config: SignatureBlockSectionConfig,
  data: PrintDocumentData,
  firm: FirmProfile,
  y: number,
): Promise<number> {
  if (!isVisible(config.showIf, data.flags)) return y;
  const { margin, colR } = geo;
  const left = config.leftLabel || firm.signatureLabelLeft || "Customer Signature";
  const right = config.rightLabel || firm.signatureLabelRight || "Authorised Signatory";
  let ry = y + 8;

  if (shouldRenderPrintStamp(firm, config.showStamp)) {
    const stampUrl = await resolveFirmAssetPreviewUrl(firm.stampImageStoragePath);
    if (stampUrl) {
      try {
        const stampImg = await urlToPdfImageData(stampUrl);
        if (stampImg) {
          const maxW = 28;
          const maxH = 24;
          const aspect = stampImg.aspectRatio || (stampImg.width && stampImg.height ? stampImg.width / stampImg.height : 1);
          let renderW = maxW;
          let renderH = renderW / aspect;
          if (renderH > maxH) {
            renderH = maxH;
            renderW = renderH * aspect;
          }
          const imgOffX = colR - 45 - renderW / 2;
          doc.addImage(
            stampImg.dataUrl,
            stampImg.format === "WEBP" ? "JPEG" : stampImg.format,
            imgOffX,
            ry,
            renderW,
            renderH,
          );
          ry += renderH + 2;
        }
      } catch {
        /* best-effort */
      }
    }
  }

  if (shouldRenderAuthorizedSignature(firm, true)) {
    const sigUrl = await resolveFirmAssetPreviewUrl(firm.authorizedSignatureStoragePath);
    if (sigUrl) {
      try {
        const sigImg = await urlToPdfImageData(sigUrl);
        if (sigImg) {
          const maxW = 36;
          const maxH = 14;
          const aspect = sigImg.aspectRatio || (sigImg.width && sigImg.height ? sigImg.width / sigImg.height : 2.5);
          let renderW = maxW;
          let renderH = renderW / aspect;
          if (renderH > maxH) {
            renderH = maxH;
            renderW = renderH * aspect;
          }
          const imgOffX = colR - 45 - renderW / 2;
          doc.addImage(
            sigImg.dataUrl,
            sigImg.format === "WEBP" ? "JPEG" : sigImg.format,
            imgOffX,
            ry,
            renderW,
            renderH,
          );
          ry += renderH + 2;
        }
      } catch {
        /* best-effort */
      }
    }
  }

  const lineY = ry + 4;
  doc.setDrawColor(150, 140, 130);
  doc.setLineWidth(0.3);
  doc.line(margin, lineY, margin + 60, lineY);
  doc.line(colR - 60, lineY, colR, lineY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(left, margin + 30, lineY + 4, { align: "center" });
  doc.text(right, colR - 30, lineY + 4, { align: "center" });
  return lineY + 10;
}

export async function addQr(
  doc: jsPDF,
  geo: Geometry,
  payload: string,
  y: number,
  size = 22,
): Promise<number> {
  try {
    const dataUrl = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 200,
    });
    doc.addImage(dataUrl, "PNG", geo.colR - size, y, size, size);
  } catch {
    // Best-effort — a QR failure should never block the rest of the PDF.
  }
  return y + size + 4;
}

export function addPageFooter(
  doc: jsPDF,
  geo: Geometry,
  firm: FirmProfile,
  pageNum?: number,
  totalPages?: number,
) {
  const pageH = doc.internal.pageSize.getHeight();
  const footerY = pageH - Math.min(15, pageH / 4);
  doc.setDrawColor(180, 170, 160);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(geo.margin, footerY, geo.colR, footerY);
  doc.setLineDashPattern([], 0);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(6.5);
  doc.setTextColor(100, 100, 100);
  doc.text(
    firm.footerLine || "Official transaction record. Handcrafted quality and guaranteed purity.",
    geo.pageW / 2,
    footerY + 5,
    { align: "center" },
  );
  if (pageNum && totalPages && totalPages > 1) {
    doc.setFont("helvetica", "normal");
    doc.text(`Page ${pageNum} of ${totalPages}`, geo.colR, footerY + 5, { align: "right" });
  }
  doc.setTextColor(0, 0, 0);
}
