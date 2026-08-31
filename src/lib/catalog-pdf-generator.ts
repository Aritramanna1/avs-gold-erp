/**
 * MTJ ERP — Authoritative Multi-Page Catalog PDF Generator.
 *
 * Uses native jsPDF vector & layout rendering (NEVER HTML screenshot/html2canvas).
 * Supports multi-page pagination, embedded product photography/SVG vectors,
 * customizable template layouts, and official firm branding.
 */
import { jsPDF } from "jspdf";
import { mgToGrams } from "@/lib/gold";
import { useSettings } from "@/lib/settings-store";
import { formatDateMedium as formatDate } from "@/lib/format-date";
import type { Design } from "@/lib/catalog-store";
import type { TemplateLayout } from "@/lib/catalog-template-store";
import { urlToPdfImageData } from "@/lib/print-engine/attachment-images";
import { useAttachments } from "@/lib/attachments-store";

export interface CatalogPdfOptions {
  templateLayout?: TemplateLayout;
  title?: string;
  showPrices?: boolean;
  showDescriptions?: boolean;
  showWeights?: boolean;
  showPurity?: boolean;
}

function resolveProductPhoto(d: Design): string | undefined {
  if (d.photoDataUrl) return d.photoDataUrl;
  const att = useAttachments.getState().items[`catalog:${d.id}:design_photo`];
  return att?.fileDataUrl || att?.thumbnailDataUrl;
}

export async function generateMultiPageCatalogPdf(
  designs: Design[],
  options: CatalogPdfOptions = {},
): Promise<{ blob: Blob; fileName: string; pageCount: number }> {
  const firm = useSettings.getState().firm;
  const layout = options.templateLayout || "four_grid";
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentW = pageW - margin * 2;
  const headerH = 26;
  const footerH = 14;
  const usableH = pageH - margin * 2 - headerH - footerH;

  // Determine items per page based on selected template layout
  let itemsPerPage = 4;
  if (layout === "single_hero") itemsPerPage = 1;
  else if (layout === "two_product" || layout === "luxury") itemsPerPage = 2;
  else if (layout === "three_product" || layout === "collection") itemsPerPage = 3;
  else if (layout === "six_grid" || layout === "minimal") itemsPerPage = 6;
  else if (layout === "price_list") itemsPerPage = 12;
  else itemsPerPage = 4; // four_grid / classic / default

  const totalPages = Math.max(1, Math.ceil(designs.length / itemsPerPage));

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    if (pageIdx > 0) doc.addPage();
    const pageNum = pageIdx + 1;
    const pageItems = designs.slice(pageIdx * itemsPerPage, (pageIdx + 1) * itemsPerPage);

    // ── 1. Header & Firm Branding ──
    doc.setFillColor(184, 134, 11); // Gold accent banner line
    doc.rect(margin, margin + headerH - 1, contentW, 0.8, "F");

    let textStartX = margin;
    if (firm?.logoUrl) {
      try {
        const logoImg = await urlToPdfImageData(firm.logoUrl);
        if (logoImg) {
          const logoDim = 18;
          doc.addImage(
            logoImg.dataUrl,
            logoImg.format === "WEBP" ? "JPEG" : logoImg.format,
            margin,
            margin + 2,
            logoDim,
            logoDim,
          );
          textStartX = margin + logoDim + 4;
        }
      } catch {
        /* skip */
      }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(30, 30, 30);
    doc.text(firm?.shopName || "AVS GOLD ERP", textStartX, margin + 7);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 100, 100);
    const subHeader = [
      firm?.address,
      firm?.phone ? `Tel: ${firm.phone}` : "",
      firm?.gstin ? `GSTIN: ${firm.gstin}` : "",
    ]
      .filter(Boolean)
      .join(" • ");
    doc.text(subHeader.slice(0, 110), textStartX, margin + 12);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(184, 134, 11);
    const titleText = options.title || "EXQUISITE JEWELLERY CATALOGUE";
    doc.text(titleText, textStartX, margin + 19);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Issued: ${formatDate(Date.now())} • ${designs.length} Selected Designs`,
      pageW - margin,
      margin + 19,
      { align: "right" },
    );

    const startY = margin + headerH + 3;

    // ── 2. Render Products According to Template Layout ──
    if (layout === "single_hero") {
      // ── SINGLE HERO (1 Product per page) ──
      const item = pageItems[0];
      if (item) {
        const cardBoxH = usableH - 6;
        doc.setDrawColor(220, 215, 205);
        doc.setLineWidth(0.3);
        doc.rect(margin, startY, contentW, cardBoxH);

        const photo = resolveProductPhoto(item);
        const imgSize = Math.min(contentW - 20, 110);
        const imgX = margin + (contentW - imgSize) / 2;
        const imgY = startY + 8;

        if (photo) {
          try {
            const img = await urlToPdfImageData(photo);
            if (img) {
              doc.addImage(img.dataUrl, img.format === "WEBP" ? "JPEG" : img.format, imgX, imgY, imgSize, imgSize);
            }
          } catch {
            /* skip */
          }
        }

        const detailsY = imgY + imgSize + 12;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(30, 30, 30);
        doc.text(item.designName || item.designNumber, pageW / 2, detailsY, { align: "center" });

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(184, 134, 11);
        doc.text(`Design Code: ${item.designNumber} • Purity: ${item.purity}‰ (${item.purity >= 916 ? "22K" : item.purity >= 750 ? "18K" : "Gold"})`, pageW / 2, detailsY + 8, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);
        doc.text(
          `Category: ${item.category} • Approx Gross: ${mgToGrams(item.approxGrossMg)}g • Approx Net: ${mgToGrams(item.approxNetMg)}g`,
          pageW / 2,
          detailsY + 16,
          { align: "center" },
        );

        if (item.notes) {
          doc.setFontSize(9);
          doc.setTextColor(100, 100, 100);
          doc.text(item.notes.slice(0, 160), pageW / 2, detailsY + 24, { align: "center" });
        }

        if (item.tags?.length) {
          doc.setFontSize(8.5);
          doc.setTextColor(140, 110, 50);
          doc.text(`Tags: ${item.tags.join(" • ")}`, pageW / 2, detailsY + 31, { align: "center" });
        }
      }
    } else if (layout === "two_product" || layout === "luxury") {
      // ── TWO PRODUCT SPREAD (2 Products per page stacked) ──
      const cardH = (usableH - 6) / 2;
      for (let i = 0; i < pageItems.length; i++) {
        const item = pageItems[i];
        const cardY = startY + i * (cardH + 4);

        doc.setDrawColor(220, 215, 205);
        doc.setLineWidth(0.3);
        doc.rect(margin, cardY, contentW, cardH);

        const imgSize = Math.min(cardH - 12, 75);
        const photo = resolveProductPhoto(item);
        if (photo) {
          try {
            const img = await urlToPdfImageData(photo);
            if (img) {
              doc.addImage(img.dataUrl, img.format === "WEBP" ? "JPEG" : img.format, margin + 6, cardY + 6, imgSize, imgSize);
            }
          } catch {
            /* skip */
          }
        }

        const textX = margin + imgSize + 14;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(30, 30, 30);
        doc.text(item.designName || item.designNumber, textX, cardY + 14);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(184, 134, 11);
        doc.text(`Design No: ${item.designNumber}   |   Purity: ${item.purity}‰`, textX, cardY + 22);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        doc.text(`Category: ${item.category}`, textX, cardY + 30);
        doc.text(`Gross Weight: ${mgToGrams(item.approxGrossMg)} g   |   Net Weight: ${mgToGrams(item.approxNetMg)} g`, textX, cardY + 37);

        if (item.notes) {
          doc.setFontSize(8.5);
          doc.setTextColor(100, 100, 100);
          doc.text(item.notes.slice(0, 95), textX, cardY + 45);
        }

        if (item.tags?.length) {
          doc.setFontSize(8);
          doc.setTextColor(140, 110, 50);
          doc.text(`Tags: ${item.tags.join(", ")}`, textX, cardY + 52);
        }
      }
    } else if (layout === "price_list") {
      // ── PRICE LIST (Tabular rate schedule) ──
      const rowH = 14;
      doc.setFillColor(245, 243, 238);
      doc.rect(margin, startY, contentW, 8, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(50, 50, 50);

      doc.text("Design Code", margin + 3, startY + 5.5);
      doc.text("Item Name & Category", margin + 35, startY + 5.5);
      doc.text("Purity", margin + 115, startY + 5.5);
      doc.text("Gross Wt", margin + 135, startY + 5.5, { align: "right" });
      doc.text("Net Wt", margin + 158, startY + 5.5, { align: "right" });
      doc.text("Difficulty", margin + contentW - 3, startY + 5.5, { align: "right" });

      let rowY = startY + 8;
      for (const item of pageItems) {
        doc.setDrawColor(230, 225, 220);
        doc.setLineWidth(0.15);
        doc.line(margin, rowY + rowH, margin + contentW, rowY + rowH);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(30, 30, 30);
        doc.text(item.designNumber, margin + 3, rowY + 6);

        doc.setFont("helvetica", "normal");
        doc.text(item.designName.slice(0, 38), margin + 35, rowY + 5);
        doc.setFontSize(7.5);
        doc.setTextColor(110, 110, 110);
        doc.text(item.category, margin + 35, rowY + 10);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(40, 40, 40);
        doc.text(`${item.purity}‰`, margin + 115, rowY + 6);
        doc.text(`${mgToGrams(item.approxGrossMg)}g`, margin + 135, rowY + 6, { align: "right" });
        doc.text(`${mgToGrams(item.approxNetMg)}g`, margin + 158, rowY + 6, { align: "right" });
        doc.text(item.difficulty.toUpperCase(), margin + contentW - 3, rowY + 6, { align: "right" });

        rowY += rowH;
      }
    } else {
      // ── GRID LAYOUT (2x2 / 4-grid or 3x2 / 6-grid) ──
      const cols = layout === "six_grid" || layout === "minimal" ? 3 : 2;
      const rows = layout === "six_grid" || layout === "minimal" ? 2 : 2;
      const cardGap = 4;
      const cardW = (contentW - (cols - 1) * cardGap) / cols;
      const cardH = (usableH - (rows - 1) * cardGap) / rows;

      for (let i = 0; i < pageItems.length; i++) {
        const item = pageItems[i];
        const colIdx = i % cols;
        const rowIdx = Math.floor(i / cols);
        const cardX = margin + colIdx * (cardW + cardGap);
        const cardY = startY + rowIdx * (cardH + cardGap);

        doc.setDrawColor(220, 215, 205);
        doc.setLineWidth(0.25);
        doc.rect(cardX, cardY, cardW, cardH);

        const imgBoxH = cardH * 0.52;
        const photo = resolveProductPhoto(item);
        if (photo) {
          try {
            const img = await urlToPdfImageData(photo);
            if (img) {
              const imgDim = Math.min(cardW - 8, imgBoxH - 6);
              const imgOffX = cardX + (cardW - imgDim) / 2;
              doc.addImage(img.dataUrl, img.format === "WEBP" ? "JPEG" : img.format, imgOffX, cardY + 3, imgDim, imgDim);
            }
          } catch {
            /* skip */
          }
        }

        const textStartY = cardY + imgBoxH + 4;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(30, 30, 30);
        doc.text(item.designName.slice(0, 26), cardX + 3, textStartY);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(184, 134, 11);
        doc.text(`${item.designNumber} • ${item.purity}‰`, cardX + 3, textStartY + 6);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(80, 80, 80);
        doc.text(`Cat: ${item.category}`, cardX + 3, textStartY + 11);
        doc.text(`GW: ${mgToGrams(item.approxGrossMg)}g | NW: ${mgToGrams(item.approxNetMg)}g`, cardX + 3, textStartY + 16);

        if (item.tags?.length && cardH > 80) {
          doc.setFontSize(7);
          doc.setTextColor(120, 100, 60);
          doc.text(item.tags.slice(0, 3).join(", ").slice(0, 28), cardX + 3, textStartY + 21);
        }
      }
    }

    // ── 3. Page Footer ──
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text(`Page ${pageNum} of ${totalPages}`, pageW / 2, pageH - margin + 4, { align: "center" });
    doc.text("Official MTJ ERP Jewellery Catalogue", pageW - margin, pageH - margin + 4, { align: "right" });
    doc.text(firm?.phone ? `Contact: ${firm.phone}` : "", margin, pageH - margin + 4);
  }

  const blob = doc.output("blob");
  const fileName = `jewellery-catalogue-${designs.length}-items-${Date.now().toString(36)}.pdf`;
  return { blob, fileName, pageCount: totalPages };
}
