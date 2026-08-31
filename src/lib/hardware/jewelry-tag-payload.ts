/**
 * Unified jewellery-tag payload shared by preview, TSPL/ZPL, and PDF fallback.
 * HUID is always separate text — never forced into the barcode symbol.
 */
import { mgToGrams } from "@/lib/gold";
import type { StockItem } from "@/lib/stock-store";
import { useBarcodeConfig } from "@/lib/barcode-config-store";
import {
  buildEncodePayload,
  type BarcodeSymbology,
} from "@/lib/barcode-symbology";

export interface JewelryTagPayload {
  itemName: string;
  itemCode: string;
  /** Value encoded in the barcode / DataMatrix (may differ from display code). */
  barcodeValue: string;
  displayCode: string;
  purityLabel: string;
  grossMg: number;
  netMg: number;
  /** Optional diamond / piece count for tag line "Dia Pcs". */
  diaPcs?: number;
  /** Hallmark UID — printed as text only. */
  huid?: string;
  symbology: BarcodeSymbology;
  grossG: string;
  netG: string;
}

export function buildJewelryTagPayload(
  item: Pick<
    StockItem,
    | "itemName"
    | "itemCode"
    | "barcode"
    | "purity"
    | "grossMg"
    | "netMg"
    | "piecesCount"
    | "huid"
  >,
  opts?: { symbology?: BarcodeSymbology },
): JewelryTagPayload {
  const cfg = useBarcodeConfig.getState().config;
  const symbology = opts?.symbology ?? cfg.symbology ?? "code128";
  const barcodeValue = buildEncodePayload({
    symbology,
    internalCode: item.barcode || item.itemCode,
    gtinPrefix: cfg.gs1CompanyPrefix,
  });
  return {
    itemName: item.itemName,
    itemCode: item.itemCode,
    barcodeValue,
    displayCode: item.itemCode || item.barcode,
    purityLabel: String(item.purity),
    grossMg: item.grossMg,
    netMg: item.netMg,
    diaPcs: item.piecesCount && item.piecesCount > 0 ? item.piecesCount : undefined,
    huid: item.huid?.trim() || undefined,
    symbology,
    grossG: mgToGrams(item.grossMg),
    netG: mgToGrams(item.netMg),
  };
}
