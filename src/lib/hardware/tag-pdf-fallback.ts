/**
 * PDF fallback for barcode/jewellery-tag label printing.
 * Same unified fields as TSPL/ZPL: Code, GW, NW, optional Dia Pcs, HUID text, barcode graphic.
 */
import { jsPDF } from "jspdf";
import JsBarcode from "jsbarcode";
import type { JewelryTagPayload } from "./jewelry-tag-payload";
import type { BarcodeSymbology } from "@/lib/barcode-symbology";

export type TagLabelData = {
  itemName: string;
  barcode: string;
  grossMg: number;
  netMg?: number;
  purity: string;
  itemCode?: string;
  huid?: string;
  diaPcs?: number;
  symbology?: BarcodeSymbology;
  barcodeValue?: string;
};

function fromPayload(p: JewelryTagPayload): TagLabelData {
  return {
    itemName: p.itemName,
    barcode: p.barcodeValue,
    barcodeValue: p.barcodeValue,
    grossMg: p.grossMg,
    netMg: p.netMg,
    purity: p.purityLabel,
    itemCode: p.displayCode,
    huid: p.huid,
    diaPcs: p.diaPcs,
    symbology: p.symbology,
  };
}

function renderLinearBarcodeDataUrl(value: string, symbology: BarcodeSymbology): string {
  const canvas = document.createElement("canvas");
  const format = symbology === "ean13" ? "EAN13" : "CODE128";
  JsBarcode(canvas, value, {
    format,
    height: 40,
    width: 1.4,
    displayValue: false,
    margin: 10,
  });
  return canvas.toDataURL("image/png");
}

async function renderDataMatrixDataUrl(value: string): Promise<string> {
  const canvas = document.createElement("canvas");
  const { renderBwipToCanvas } = await import("./bwip-canvas");
  try {
    await renderBwipToCanvas(canvas, {
      bcid: "gs1datamatrix",
      text: value,
      scale: 2,
      height: 10,
    });
  } catch {
    await renderBwipToCanvas(canvas, {
      bcid: "datamatrix",
      text: value,
      scale: 2,
      height: 10,
    });
  }
  return canvas.toDataURL("image/png");
}

export function generateTagLabelPdf(item: TagLabelData | JewelryTagPayload): Blob {
  const data: TagLabelData =
    "barcodeValue" in item && "grossG" in item
      ? fromPayload(item as JewelryTagPayload)
      : (item as TagLabelData);
  const symbology = data.symbology ?? "code128";
  const encodeValue = data.barcodeValue || data.barcode;
  const grossG = (data.grossMg / 1000).toFixed(3);
  const netG =
    data.netMg != null ? (data.netMg / 1000).toFixed(3) : undefined;

  const doc = new jsPDF({ unit: "mm", format: [40, 25], orientation: "portrait" });

  doc.setFontSize(7);
  doc.text(data.itemName.slice(0, 24), 2, 3.5);
  doc.setFontSize(5.5);
  doc.text(`GW ${grossG}g  NW ${netG ?? "—"}g`, 2, 7);
  doc.text(`Purity: ${data.purity}`, 2, 10);
  let y = 12.5;
  if (data.diaPcs != null) {
    doc.text(`Dia Pcs: ${data.diaPcs}`, 2, y);
    y += 2.5;
  }
  if (data.huid) {
    doc.text(`HUID: ${data.huid.slice(0, 20)}`, 2, y);
    y += 2.5;
  }

  try {
    // Synchronous path for linear; DataMatrix uses a pre-drawn blank if async fails in sync API.
    if (symbology === "gs1_datamatrix") {
      // Best-effort sync: leave placeholder; downloadTagLabelPdfAsync preferred for DM.
      doc.setFontSize(5);
      doc.text(`DM: ${encodeValue.slice(0, 28)}`, 2, Math.min(y + 2, 20));
    } else {
      const barcodeDataUrl = renderLinearBarcodeDataUrl(encodeValue, symbology);
      doc.addImage(barcodeDataUrl, "PNG", 2, Math.min(y, 14), 36, 7);
    }
  } catch {
    doc.setFontSize(5);
    doc.text(`(barcode failed: ${encodeValue.slice(0, 24)})`, 2, 17);
  }

  doc.setFontSize(5.5);
  doc.text(`Code: ${(data.itemCode || data.barcode).slice(0, 28)}`, 2, 23.5);

  return doc.output("blob");
}

/** Async PDF that can rasterize DataMatrix via bwip-js. */
export async function generateTagLabelPdfAsync(
  item: TagLabelData | JewelryTagPayload,
): Promise<Blob> {
  const data: TagLabelData =
    "barcodeValue" in item && "grossG" in item
      ? fromPayload(item as JewelryTagPayload)
      : (item as TagLabelData);
  if ((data.symbology ?? "code128") !== "gs1_datamatrix") {
    return generateTagLabelPdf(data);
  }

  const encodeValue = data.barcodeValue || data.barcode;
  const grossG = (data.grossMg / 1000).toFixed(3);
  const netG = data.netMg != null ? (data.netMg / 1000).toFixed(3) : undefined;
  const doc = new jsPDF({ unit: "mm", format: [40, 25], orientation: "portrait" });
  doc.setFontSize(7);
  doc.text(data.itemName.slice(0, 24), 2, 3.5);
  doc.setFontSize(5.5);
  doc.text(`GW ${grossG}g  NW ${netG ?? "—"}g`, 2, 7);
  doc.text(`Purity: ${data.purity}`, 2, 10);
  let y = 12.5;
  if (data.diaPcs != null) {
    doc.text(`Dia Pcs: ${data.diaPcs}`, 2, y);
    y += 2.5;
  }
  if (data.huid) {
    doc.text(`HUID: ${data.huid.slice(0, 20)}`, 2, y);
    y += 2.5;
  }
  try {
    const url = await renderDataMatrixDataUrl(encodeValue);
    doc.addImage(url, "PNG", 14, Math.min(y, 13), 12, 12);
  } catch {
    doc.text(`DM fail`, 2, 18);
  }
  doc.setFontSize(5.5);
  doc.text(`Code: ${(data.itemCode || data.barcode).slice(0, 28)}`, 2, 23.5);
  return doc.output("blob");
}

export function downloadTagLabelPdf(item: TagLabelData | JewelryTagPayload): void {
  const blob = generateTagLabelPdf(item);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const code =
    "displayCode" in item
      ? (item as JewelryTagPayload).displayCode
      : (item as TagLabelData).itemCode || (item as TagLabelData).barcode;
  a.download = `label-${code}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadTagLabelPdfAsync(
  item: TagLabelData | JewelryTagPayload,
): Promise<void> {
  const blob = await generateTagLabelPdfAsync(item);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const code =
    "displayCode" in item
      ? (item as JewelryTagPayload).displayCode
      : (item as TagLabelData).itemCode || (item as TagLabelData).barcode;
  a.download = `label-${code}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
