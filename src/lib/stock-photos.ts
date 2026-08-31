/**
 * Ready Stock product photos — one or many under attachment keys
 * `product_photo_*`, plus legacy `design_photo` / `item_photo` and
 * `imageStoragePath` on the stock row.
 */
import { useAttachments } from "@/lib/attachments-store";
import type { StockItem } from "@/lib/stock-store";

const PHOTO_PREFIX = "product_photo_";
const LEGACY_PHOTO_KEYS = ["design_photo", "item_photo"] as const;

export function isStockProductPhotoKey(docKey: string): boolean {
  return docKey.startsWith(PHOTO_PREFIX) || (LEGACY_PHOTO_KEYS as readonly string[]).includes(docKey);
}

/** Count of filed product photos for a stock item. */
export function countStockProductPhotos(stockId: string): number {
  const list = useAttachments.getState().listForEntity("stock", stockId);
  return list.filter(({ docKey, rec }) => isStockProductPhotoKey(docKey) && rec.filed).length;
}

/** True if the item has ≥1 product photo (gallery, legacy key, or primary storage path). */
export function stockItemHasProductPhoto(
  item: Pick<StockItem, "id" | "imageStoragePath">,
): boolean {
  if (item.imageStoragePath?.trim()) return true;
  if (countStockProductPhotos(item.id) > 0) return true;
  const attachments = useAttachments.getState().items;
  for (const key of LEGACY_PHOTO_KEYS) {
    const rec = attachments[`stock:${item.id}:${key}`];
    if (rec?.filed || rec?.thumbnailDataUrl || rec?.fileDataUrl || rec?.storagePath) return true;
  }
  return false;
}

/** Required catalogue fields for a sellable ready-stock piece. */
export function stockItemMissingDetails(
  item: Pick<StockItem, "itemName" | "category" | "purity" | "grossMg" | "netMg">,
): string[] {
  const missing: string[] = [];
  if (!item.itemName?.trim()) missing.push("item name");
  if (!item.category?.trim()) missing.push("category");
  if (!item.purity || item.purity <= 0) missing.push("purity");
  if (!item.grossMg || item.grossMg <= 0) missing.push("gross weight");
  if (!item.netMg || item.netMg <= 0) missing.push("net weight");
  return missing;
}

export function assertReadyStockSellable(
  item: Pick<StockItem, "id" | "itemName" | "category" | "purity" | "grossMg" | "netMg" | "imageStoragePath">,
): void {
  const missing = stockItemMissingDetails(item);
  if (missing.length) {
    throw new Error(
      `Ready stock "${item.itemName || item.id}" is missing details: ${missing.join(", ")}.`,
    );
  }
  if (!stockItemHasProductPhoto(item)) {
    throw new Error(
      `Ready stock "${item.itemName || item.id}" needs at least one product photo before it can be billed.`,
    );
  }
}
