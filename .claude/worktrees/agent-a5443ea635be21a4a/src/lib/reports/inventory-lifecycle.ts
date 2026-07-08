/**
 * Inventory Lifecycle Reporting (Priority 5): Stock Movement Timeline,
 * Inventory Ageing, and Dead Stock — all three are read-only views over
 * data stock-store.ts already fully tracks (StockItem.createdAt/status,
 * StockMovement.ts/kind/fromStatus/toStatus/fromLocation/toLocation). No
 * new tracking was needed; this module is purely the query/aggregation
 * layer that was missing on top of it.
 */
import { useStock, type StockItem, type StockMovement } from "@/lib/stock-store";

/** Every movement for one item, oldest first, with the item's own creation as the implicit first event. */
export function getItemTimeline(itemId: string): StockMovement[] {
  return useStock
    .getState()
    .movements.filter((m) => m.itemId === itemId)
    .sort((a, b) => a.ts - b.ts);
}

function lastActivityTs(item: StockItem, movements: StockMovement[]): number {
  const itemMovements = movements.filter((m) => m.itemId === item.id);
  if (itemMovements.length === 0) return item.createdAt;
  return Math.max(item.createdAt, ...itemMovements.map((m) => m.ts));
}

export type AgeingBucket = "0-30" | "31-60" | "61-90" | "91-180" | "181+";

export interface AgeingReportRow {
  item: StockItem;
  daysSinceLastActivity: number;
  bucket: AgeingBucket;
}

function bucketFor(days: number): AgeingBucket {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  if (days <= 180) return "91-180";
  return "181+";
}

/** Ageing report over every AVAILABLE item (sold/scrapped items have left inventory, not "aged" inventory). */
export function getInventoryAgeingReport(asOfMs: number = Date.now()): AgeingReportRow[] {
  const { items, movements } = useStock.getState();
  return items
    .filter((i) => i.status === "available")
    .map((item) => {
      const lastTs = lastActivityTs(item, movements);
      const daysSinceLastActivity = Math.floor((asOfMs - lastTs) / (24 * 60 * 60 * 1000));
      return { item, daysSinceLastActivity, bucket: bucketFor(daysSinceLastActivity) };
    })
    .sort((a, b) => b.daysSinceLastActivity - a.daysSinceLastActivity);
}

/** Available items with no activity in over `thresholdDays` — the actionable "needs attention" list, not just an ageing statistic. */
export function getDeadStockReport(thresholdDays = 180, asOfMs: number = Date.now()): AgeingReportRow[] {
  return getInventoryAgeingReport(asOfMs).filter((row) => row.daysSinceLastActivity >= thresholdDays);
}

export interface AgeingSummary {
  totalAvailableItems: number;
  totalAvailableFineMg: number;
  byBucket: Record<AgeingBucket, { count: number; fineMg: number }>;
}

export function getAgeingSummary(asOfMs: number = Date.now()): AgeingSummary {
  const rows = getInventoryAgeingReport(asOfMs);
  const byBucket: AgeingSummary["byBucket"] = {
    "0-30": { count: 0, fineMg: 0 },
    "31-60": { count: 0, fineMg: 0 },
    "61-90": { count: 0, fineMg: 0 },
    "91-180": { count: 0, fineMg: 0 },
    "181+": { count: 0, fineMg: 0 },
  };
  let totalFineMg = 0;
  for (const row of rows) {
    byBucket[row.bucket].count += 1;
    byBucket[row.bucket].fineMg += row.item.fineMg;
    totalFineMg += row.item.fineMg;
  }
  return { totalAvailableItems: rows.length, totalAvailableFineMg: totalFineMg, byBucket };
}
