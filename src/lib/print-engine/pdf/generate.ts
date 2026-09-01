/**
 * Unified Print Engine — single PDF export entry point.
 *
 * Replaces the pattern of one bespoke generateXPdf() per doc type
 * (document-pdf-generator.ts, gold-settlement-pdf.ts, job-card-pdf.ts,
 * outside-worker-statement-pdf.ts) with one function that walks a
 * template's sections and draws each with the shared toolkit — so a
 * layout change made in one place (the template) is reflected in both
 * the on-screen preview (sections.tsx) and the exported PDF automatically.
 */
import { jsPDF } from "jspdf";
import { ARCHIVAL_SIZES } from "@/components/print/PrintLayout";
import { usePrintSetup } from "@/lib/print-setup-store";
import type { FirmProfile } from "@/lib/settings-store";
import { payloadFor } from "@/lib/verify-token";
import { verifyUrl } from "@/lib/link-hosts";
import { shouldRenderVerificationQr } from "@/lib/print-engine/print-branding";
import { formatDateMedium as formatDate } from "@/lib/format-date";
import {
  printImageItemsForSection,
  urlToPdfImageData,
} from "@/lib/print-engine/attachment-images";
import type { PrintDocumentData, PrintTemplate, SectionConfig } from "../types";
import { isVisible } from "../resolve";
import {
  addBalanceCard,
  addBilledToStamp,
  addDataList,
  addDocHeader,
  addFieldGrid,
  addPageFooter,
  addPremiumHeader,
  addQr,
  addRichText,
  addSignatureBlock,
  addTable,
  addTagCards,
  addThermalItemList,
  geometryFor,
  type Geometry,
} from "./toolkit";

const PAPER_SIZE_TO_JSPDF: Record<PrintTemplate["paperSize"], string | [number, number]> = {
  a4: "a4",
  a5: "a5",
  // Half A4 = A5 on its side. The SIZE is a5; the rotation is the orientation
  // flag below. jsPDF normalises a format array to portrait (it puts the
  // smaller number first), so handing it [210, 148] would silently produce a
  // portrait A5 — the landscape job card would come out the wrong way round.
  a5l: "a5",
  a6: "a6",
  thermal: [80, 200],
  thermal58: [58, 200],
  tag: [50, 30],
};

/** Formats whose page is wider than it is tall. */
function jsPdfOrientation(paperSize: PrintTemplate["paperSize"]): "portrait" | "landscape" {
  return paperSize === "a5l" ? "landscape" : "portrait";
}

async function drawSection(
  doc: jsPDF,
  geo: Geometry,
  section: SectionConfig,
  data: PrintDocumentData,
  firm: FirmProfile,
  y: number,
): Promise<number> {
  switch (section.type) {
    case "header":
      return await addDocHeader(doc, geo, firm, data.title, data.docNumber, formatDate(data.createdAt));
    case "premiumHeader":
      return await addPremiumHeader(doc, geo, section, data, firm, y);
    case "fieldGrid":
      return addFieldGrid(doc, geo, section, data, y);
    case "party":
      // A party block draws like a titled field grid for PDF purposes —
      // same label/value shape, just sourced from namePath + subFields.
      return addFieldGrid(
        doc,
        geo,
        {
          type: "fieldGrid",
          id: section.id,
          title: section.title,
          fields: [{ label: "Name", valuePath: section.namePath }, ...section.subFields],
          showIf: section.showIf,
        },
        data,
        y,
      );
    case "billedToStamp":
      return addBilledToStamp(doc, geo, section, data, y);
    case "table":
      return addTable(doc, geo, section, data, y);
    case "balanceCard":
      return addBalanceCard(doc, geo, section, data, y);
    case "richText":
      return addRichText(doc, geo, section, data, y);
    case "dataList":
      return addDataList(doc, geo, section, data, y);
    case "thermalItemList":
      return addThermalItemList(doc, geo, section, data, y);
    case "signatureBlock":
      return await addSignatureBlock(doc, geo, section, data, firm, y);
    case "row": {
      // PDF has no free-form multi-column layout primitive here — columns
      // are drawn sequentially (top to bottom) instead of side by side.
      // Content and totals are unaffected; only the on-screen side-by-side
      // arrangement doesn't carry over to the exported PDF.
      let ry = y;
      for (const col of section.columns) {
        for (const sub of col) {
          ry = await drawSection(doc, geo, sub, data, firm, ry);
        }
      }
      return ry;
    }
    case "tagCards":
      addTagCards(doc, geo, section, data, firm);
      return y;
    case "pageBreak":
      doc.addPage();
      return geo.margin;
    case "qr": {
      if (!shouldRenderVerificationQr(firm)) return y;
      const payload = payloadFor({
        docType: data.docType,
        docNumber: data.docNumber,
        recordId: data.recordId,
        createdAt: data.createdAt,
      });
      return addQr(doc, geo, verifyUrl(payload), y);
    }
    case "images": {
      if (!isVisible(section.showIf, data.flags)) return y;
      const items = printImageItemsForSection(data, section.imagesKey).slice(
        0,
        section.maxThumbnails ?? 8,
      );
      if (items.length === 0) return y;

      let cy = y;

      if (section.title) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(section.title, geo.margin, cy + 4);
        cy += 8;
      }

      for (const item of items) {
        try {
          const img = await urlToPdfImageData(item.url);
          if (img) {
            const aspect = img.aspectRatio || (img.width && img.height ? img.width / img.height : 1.33);
            const maxW = section.fullPagePerImage ? geo.contentW - 4 : geo.contentW - 8;
            const maxH = section.fullPagePerImage ? 230 : 90;

            let renderW = maxW;
            let renderH = renderW / aspect;
            if (renderH > maxH) {
              renderH = maxH;
              renderW = renderH * aspect;
            }

            const pageH = doc.internal.pageSize.getHeight();
            if (cy + renderH + 12 > pageH - geo.margin) {
              doc.addPage();
              cy = geo.margin;
            }

            const offsetX = (geo.contentW - renderW) / 2;
            doc.addImage(
              img.dataUrl,
              img.format === "WEBP" ? "JPEG" : img.format,
              geo.margin + offsetX,
              cy,
              renderW,
              renderH,
            );
            cy += renderH + 2;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            doc.text(item.label.slice(0, 80), geo.margin + offsetX, cy + 3);
            cy += 7;
          }
        } catch {
          /* skip broken image */
        }
        if (section.fullPagePerImage && items.indexOf(item) < items.length - 1) {
          doc.addPage();
          cy = geo.margin;
        }
      }
      return cy + 4;
    }
    default:
      return y;
  }
}

export async function generateDocumentPdf(
  data: PrintDocumentData,
  template: PrintTemplate,
  firm: FirmProfile,
): Promise<{ blob: Blob; fileName: string }> {
  // The user's page setup governs the exported PDF too — otherwise "Download
  // PDF" would silently ignore the paper size / orientation / margins chosen
  // for the very document on screen, and the file would not match its preview.
  const setup = usePrintSetup.getState();
  const paperSize = setup.sizeOverride ?? template.paperSize;
  const orientation = ARCHIVAL_SIZES.includes(paperSize)
    ? (setup.orientation ?? jsPdfOrientation(paperSize))
    : jsPdfOrientation(paperSize);

  const doc = new jsPDF({
    unit: "mm",
    format: PAPER_SIZE_TO_JSPDF[paperSize],
    orientation,
  });
  // ponytail: the jsPDF layout engine lays out against ONE symmetric margin,
  // so the left value is applied on all four sides here (the HTML/print path
  // honours all four independently). Give Geometry per-side margins if a
  // workshop ever needs an asymmetric PDF export.
  const geo = geometryFor(doc, paperSize, setup.margins?.left);
  const hasOwnHeader = template.sections.some(
    (s) => s.type === "header" || s.type === "premiumHeader",
  );

  let y = hasOwnHeader
    ? geo.margin
    : await addDocHeader(doc, geo, firm, data.title, data.docNumber, formatDate(data.createdAt));

  for (const section of template.sections) {
    y = await drawSection(doc, geo, section, data, firm, y);
  }

  if (template.paperSize !== "tag") {
    // Stamp the footer (and page numbers) on every page the content grew to —
    // addTable may have added pages, so this runs after all sections are drawn.
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      addPageFooter(doc, geo, firm, p, totalPages);
    }
  }

  const safeName = data.docNumber.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `${firm.shopName?.replace(/\s+/g, "_") || "ERP"}_${data.docType}_${safeName}.pdf`;
  return { blob: doc.output("blob"), fileName };
}
