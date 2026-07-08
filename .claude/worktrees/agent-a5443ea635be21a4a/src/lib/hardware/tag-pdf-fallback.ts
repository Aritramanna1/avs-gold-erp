/**
 * PDF fallback for barcode/jewellery-tag label printing (Priority 7).
 *
 * When no physical label printer (TSPL/ZPL over WebUSB/serial) is
 * available, a print job must never simply fail or vanish — it becomes a
 * downloadable PDF containing the exact same fields the label printer
 * would have printed (item name, purity, gross weight, barcode, item
 * code), sized to the same 40mm x 25mm label dimensions as
 * generateTsplTagCommand/generateZplTagCommand in hardware-service.ts, so
 * it can be printed later on any regular printer (including onto
 * pre-cut/adhesive label sheets) without needing the specific hardware now.
 */
import { jsPDF } from "jspdf";
import JsBarcode from "jsbarcode";

export interface TagLabelData {
  itemName: string;
  barcode: string;
  grossMg: number;
  purity: string;
  itemCode?: string;
}

function renderBarcodeDataUrl(value: string): string {
  const canvas = document.createElement("canvas");
  JsBarcode(canvas, value, {
    format: "CODE128",
    height: 40,
    width: 1.4,
    displayValue: false,
    margin: 0,
  });
  return canvas.toDataURL("image/png");
}

/**
 * Generates a single-label PDF (40mm x 25mm page) and returns it as a Blob.
 * Caller decides whether to trigger a download, open in a new tab, or
 * attach it elsewhere — this function has no DOM side effects itself
 * beyond the offscreen canvas used to rasterize the barcode.
 */
export function generateTagLabelPdf(item: TagLabelData): Blob {
  const doc = new jsPDF({ unit: "mm", format: [40, 25], orientation: "portrait" });
  const grossG = (item.grossMg / 1000).toFixed(3);

  doc.setFontSize(7);
  doc.text(item.itemName.slice(0, 24), 2, 4);
  doc.setFontSize(6);
  doc.text(`Purity: ${item.purity}`, 2, 8);
  doc.text(`Gross: ${grossG} g`, 2, 11.5);

  try {
    const barcodeDataUrl = renderBarcodeDataUrl(item.barcode);
    doc.addImage(barcodeDataUrl, "PNG", 2, 13, 36, 8);
  } catch {
    // A malformed barcode value shouldn't take down the whole fallback —
    // the label still prints with its text fields, just without the
    // scannable barcode graphic.
    doc.setFontSize(6);
    doc.text(`(barcode render failed: ${item.barcode})`, 2, 17);
  }

  doc.setFontSize(6);
  doc.text(`Code: ${item.itemCode || item.barcode}`, 2, 23.5);

  return doc.output("blob");
}

/** Generates the PDF and triggers a browser download — the concrete "PDF fallback" action a print button calls when no label printer is detected. */
export function downloadTagLabelPdf(item: TagLabelData): void {
  const blob = generateTagLabelPdf(item);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `label-${item.itemCode || item.barcode}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
