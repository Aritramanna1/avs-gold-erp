/**
 * A4 report PDF from structured table rows — not a screenshot of the React page.
 * Reuses Print Engine paper, margins, header, footer, and pagination.
 */
import { jsPDF } from "jspdf";
import { useSettings } from "@/lib/settings-store";
import { formatDateMedium as formatDate, formatDateShort } from "@/lib/format-date";
import { addDocHeader, addPageFooter, geometryFor } from "./toolkit";
import { applyTenantTerminology } from "@/lib/terminology-engine-store";

export interface ReportPdfInput {
  title: string;
  subtitle?: string;
  from?: string;
  to?: string;
  /** One or more tables; each inner array is a row of cell strings. First row may be headers. */
  tables: string[][][];
}

export function extractReportTables(root: ParentNode | null): string[][][] {
  if (!root) return [];
  const tables: string[][][] = [];
  root.querySelectorAll("table").forEach((table) => {
    const rows: string[][] = [];
    table.querySelectorAll("tr").forEach((tr) => {
      const cells = [...tr.querySelectorAll("th,td")].map((c) =>
        (c.textContent ?? "").replace(/\s+/g, " ").trim(),
      );
      if (cells.some((c) => c)) rows.push(cells);
    });
    if (rows.length) tables.push(rows);
  });
  return tables;
}

export async function generateReportPdf(
  input: ReportPdfInput,
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
  const range =
    input.from || input.to
      ? [input.from ? formatDateShort(input.from) : "", input.to ? formatDateShort(input.to) : ""]
          .filter(Boolean)
          .join(" to ")
      : "";

  let y = await addDocHeader(doc, geo, firm, applyTenantTerminology(input.title, true), range || "Report", formatDate(Date.now()));
  if (input.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(
      applyTenantTerminology(input.subtitle, true),
      geo.contentW,
    ) as string[];
    doc.text(lines, geo.margin, y);
    y += lines.length * 4.5 + 2;
  }

  const tables = (
    input.tables.length ? input.tables : [[["No tabular data for this period."]]]
  ).map((table) => table.map((row) => row.map((cell) => applyTenantTerminology(cell, true))));

  for (const table of tables) {
    if (y > bottomLimit - 20) {
      doc.addPage();
      y = geo.margin;
    }
    const colCount = Math.max(1, ...table.map((r) => r.length));
    const colW = geo.contentW / colCount;
    const fontSize = colCount > 6 ? 7 : colCount > 4 ? 8 : 9;
    doc.setFontSize(fontSize);
    const rowH = fontSize < 8 ? 5 : 6;

    table.forEach((row, ri) => {
      if (y + rowH > bottomLimit) {
        doc.addPage();
        y = geo.margin;
      }
      if (ri === 0) {
        doc.setFillColor(245, 245, 244);
        doc.rect(geo.margin, y - 4, geo.contentW, rowH, "F");
        doc.setFont("helvetica", "bold");
      } else {
        doc.setFont("helvetica", "normal");
      }
      for (let c = 0; c < colCount; c++) {
        const text = doc.splitTextToSize(row[c] ?? "", colW - 1.5) as string[];
        doc.text(text[0] ?? "", geo.margin + c * colW + 0.6, y);
      }
      y += rowH;
    });
    y += 6;
  }

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    addPageFooter(doc, geo, firm, p, totalPages);
  }

  const safe = input.title.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 60) || "report";
  return { blob: doc.output("blob"), fileName: `${safe}.pdf` };
}
