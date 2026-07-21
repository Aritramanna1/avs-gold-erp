/**
 * Digital Job Card Engine.
 *
 * Single source of truth for turning a Production Order (orders-store.ts's
 * `Order`) — optionally enriched by its linked workshop JobCard, once one
 * exists — into the normalized shape the Job Card PDF/preview renders from.
 * Every future job card (this phase, and any later phase) should go through
 * `buildJobCardData()` so the print layout never has to know about Order/
 * JobCard's internal field names directly.
 *
 * Scope for this phase: read-only generation from data that already exists
 * (Production Order + linked JobCard, if any). It does NOT touch Billing,
 * Gold Ledger, Inventory, Reports, or Communication — nothing here writes
 * anywhere.
 *
 * Extension points (documented, not implemented yet): `materialIssue` and
 * `goldIssue` are reserved fields for a future phase that will populate them
 * from the Job Card's actual gold-issue/material-issue records once that
 * workflow exists. Leaving them optional/undefined now means the print
 * layout can grow into them later without a breaking change to this shape.
 */
import { orderItems, type Order, type OrderItem } from "./orders-store";
import type { JobCard } from "./jobcards-store";
import { useAttachments } from "./attachments-store";
import { formatAttributes } from "./product-attributes";

export interface JobCardPrintData {
  jobCardNo: string;
  productionOrderNo: string;
  customerName: string;
  customerPhone?: string;
  itemName: string;
  itemDescription: string;
  referenceImages: string[]; // data URLs, already-filed attachments only
  targetGrossMg: number;
  targetNetMg: number;
  purity: number;
  goldReceivedGrossMg: number;
  goldReceivedFineMg: number;
  assignedWorkerName: string | null;
  expectedDelivery?: string;
  /** When the bench is expected to START — not the same as the deadline. */
  expectedStart?: string;
  remarks?: string;
  qrPayload: string;
  generatedAt: number;

  // ── Extension points — reserved, not populated in this phase ──────────
  materialIssue?: unknown;
  goldIssue?: unknown;
}

const ORDER_REFERENCE_IMAGE_SLOTS = [
  "design_photo",
  "customer_reference",
  "die_photo",
  "stones_photo",
] as const;

/**
 * A multi-item order carries reference images per LINE, not per order — the
 * photo of the bangle is not the photo of the ring, and the karigar at the
 * bench needs the one for the piece in front of them. Line images live under
 * `design_photo__<lineId>`, which keeps them inside the existing
 * `order:<id>:<docKey>` attachment namespace (so the vault, sync, and backup
 * paths need no changes) while staying distinguishable from the four
 * order-level slots above.
 */
export const LINE_REFERENCE_PREFIX = "design_photo__";

export function lineReferenceDocKey(lineId: string): string {
  return `${LINE_REFERENCE_PREFIX}${lineId}`;
}

/**
 * The attachment docKeys holding an order's reference images. Pass `lineId` for
 * one line's images; omit it for every image on the order (order-level slots
 * plus every line's).
 */
export function referenceImageDocKeys(orderId: string, lineId?: string): string[] {
  const items = useAttachments.getState().items;
  const prefix = `order:${orderId}:`;
  const docKeys = Object.keys(items)
    .filter((k) => k.startsWith(prefix))
    .map((k) => k.slice(prefix.length));

  const orderLevel = docKeys.filter((k) =>
    (ORDER_REFERENCE_IMAGE_SLOTS as readonly string[]).includes(k),
  );

  if (lineId) {
    const own = docKeys.filter((k) => k === lineReferenceDocKey(lineId));
    // A line with its own photo shows only that. A line without one still gets
    // the order-level reference rather than a job card with a blank image box —
    // an empty reference is worse than a shared one at the bench.
    return own.length > 0 ? own : orderLevel;
  }

  return [...orderLevel, ...docKeys.filter((k) => k.startsWith(LINE_REFERENCE_PREFIX))];
}

/**
 * Reference images as directly-renderable URLs.
 *
 * ponytail: thumbnail (inlined on the row) rather than the full-size bytes,
 * because this is a synchronous accessor and vault reads are async. Fine for an
 * on-screen job-card preview. Anything that PRINTS these must use
 * `referenceImageDocKeys()` + `getAttachmentUrl()` instead — a 240px thumbnail
 * blown up to a printed reference photo is useless at the bench.
 */
export function referenceImagesForOrder(orderId: string, lineId?: string): string[] {
  const items = useAttachments.getState().items;
  return referenceImageDocKeys(orderId, lineId)
    .map((slot) => items[`order:${orderId}:${slot}`])
    .filter(
      (rec): rec is NonNullable<typeof rec> =>
        !!rec?.filed && !!(rec.fileDataUrl || rec.thumbnailDataUrl),
    )
    .map((rec) => (rec.fileDataUrl || rec.thumbnailDataUrl)!);
}

function itemDescriptionFor(order: Order, item: OrderItem): string {
  const parts: string[] = [];
  if (item.quantity > 1) parts.push(`Qty: ${item.quantity}`);
  if (item.size) parts.push(`Size: ${item.size}`);
  // The category's own dimensions — ring size, chain length, bangle diameter.
  // These are what the karigar actually works to.
  const attrs = formatAttributes(item.category, item.attributes);
  if (attrs) parts.push(attrs);
  parts.push(`${item.metal} · ${item.metalColor}`);
  if (item.stoneDetails) parts.push(`Stones: ${item.stoneDetails}`);
  if (order.design.pattern) parts.push(`Pattern: ${order.design.pattern}`);
  if (order.design.designNumber) parts.push(`Design No: ${order.design.designNumber}`);
  return parts.join(" · ");
}

/**
 * The order line a Job Card is for.
 *
 * An order holds several pieces and each one has its own card, so a card must
 * resolve ITS OWN line — not `order.item` (the first line), which would print
 * the same piece on all three cards of a three-item order. Cards created before
 * multi-item carry no `lineId` and correctly fall back to the first line.
 */
function lineFor(order: Order, jobCard: JobCard | null | undefined): OrderItem {
  const items = orderItems(order);
  if (jobCard?.lineId) {
    const match = items.find((it) => it.lineId === jobCard.lineId);
    if (match) return match;
  }
  return items[0] ?? order.item;
}

/**
 * Builds the print-ready data for ONE Job Card — one line of a Production
 * Order, one bench job.
 *
 * `jobCard`, when the order has one, supplies the authoritative job number, the
 * assigned karigar, and (via its `lineId`) which piece this card is for.
 * Without one, everything falls back to the order's first line.
 */
export function buildJobCardData(
  order: Order,
  jobCard: JobCard | null | undefined,
  customerName: string,
  customerPhone: string | undefined,
  karigarNameFallback: string | null,
): JobCardPrintData {
  const item = lineFor(order, jobCard);

  const qrPayload = JSON.stringify({
    type: "job_card",
    orderNo: order.orderNo,
    jobNo: jobCard?.jobNo ?? order.orderNo,
    orderId: order.id,
    jobCardId: jobCard?.id,
    lineId: item.lineId,
  });

  return {
    jobCardNo: jobCard?.jobNo ?? `JC-${order.orderNo}`,
    productionOrderNo: order.orderNo,
    customerName,
    customerPhone,
    itemName: item.itemName || item.category,
    itemDescription: itemDescriptionFor(order, item),
    // Only THIS line's reference photos — the karigar making the bangle should
    // not be handed the photo of the ring.
    referenceImages: referenceImagesForOrder(order.id, item.lineId),
    targetGrossMg: item.grossMg,
    targetNetMg: item.netMg,
    purity: item.purity,
    goldReceivedGrossMg: order.advance.goldGrossMg,
    goldReceivedFineMg: order.advance.goldFineMg,
    assignedWorkerName: jobCard?.karigarName ?? karigarNameFallback,
    expectedDelivery: order.expectedDelivery,
    // Scheduled on the CARD, not the order — each piece can start on its own day.
    expectedStart: jobCard?.expectedStart,
    remarks: order.design.notes || item.remarks,
    qrPayload,
    generatedAt: Date.now(),
  };
}
