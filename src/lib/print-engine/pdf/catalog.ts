/**
 * Design catalog PDF from selected catalog records (photos + milligram weights).
 * Print Engine paper/margins/pagination — not a screenshot.
 */
import { jsPDF } from "jspdf";
import { mgToGrams } from "@/lib/gold";
import { useSettings } from "@/lib/settings-store";
import { useAttachments } from "@/lib/attachments-store";
import { formatDateMedium as formatDate } from "@/lib/format-date";
import type { Design } from "@/lib/catalog-store";
import { addDocHeader, addPageFooter, geometryFor } from "./toolkit";
import { urlToPdfImageData } from "@/lib/print-engine/attachment-images";

function designPhoto(design: Design): string | undefined {
  if (design.photoDataUrl) return design.photoDataUrl;
  const att = useAttachments.getState().items[`catalog:${design.id}:design_photo`];
  return att?.fileDataUrl || att?.thumbnailDataUrl;
}

export async function generateCatalogPdf(
  designs: Design[],
): Promise<{ blob: Blob; fileName: string }> {
  try {
    const { refreshFirmLogoSignedUrl } = await import("@/lib/storage");
    await refreshFirmLogoSignedUrl();
  } catch {
    /* non-fatal */
  }
  const firm = useSettings.getState().firm;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const geo = geometryFor(doc, "a4");
  const pageH = doc.internal.pageSize.getHeight();
  const bottomLimit = pageH - 18;
  let y = await addDocHeader(
    doc,
    geo,
    firm,
    "Design Catalog",
    `${designs.length} piece${designs.length === 1 ? "" : "s"}`,
    formatDate(Date.now()),
  );

  const cardH = 52;
  const imgW = 42;
  const imgH = 42;

  for (const design of designs) {
    if (y + cardH > bottomLimit) {
      doc.addPage();
      y = geo.margin;
    }
    doc.setDrawColor(210, 205, 198);
    doc.setLineWidth(0.2);
    doc.rect(geo.margin, y, geo.contentW, cardH - 4);

    const photo = designPhoto(design);
    if (photo) {
      try {
        const img = await urlToPdfImageData(photo);
        if (img) {
          doc.addImage(
            img.dataUrl,
            img.format === "WEBP" ? "JPEG" : img.format,
            geo.margin + 2,
            y + 3,
            imgW,
            imgH,
          );
        }
      } catch {
        /* skip broken image */
      }
    }

    const textX = geo.margin + imgW + 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(design.designName || design.designNumber, textX, y + 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`No: ${design.designNumber}`, textX, y + 16);
    doc.text(`Category: ${design.category}`, textX, y + 22);
    doc.text(`Purity: ${design.purity}`, textX, y + 28);
    doc.text(
      `Gross: ${mgToGrams(design.approxGrossMg)} g   Net: ${mgToGrams(design.approxNetMg)} g`,
      textX,
      y + 34,
    );
    if (design.tags?.length) {
      doc.setFontSize(8);
      doc.text(`Tags: ${design.tags.join(", ")}`.slice(0, 80), textX, y + 40);
    }
    y += cardH;
  }

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    addPageFooter(doc, geo, firm, p, totalPages);
  }

  return { blob: doc.output("blob"), fileName: `design-catalog-${designs.length}.pdf` };
}
