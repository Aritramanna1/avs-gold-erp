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
import type { Order } from "./orders-store";
import type { JobCard } from "./jobcards-store";
import { useAttachments } from "./attachments-store";

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

export function referenceImagesForOrder(orderId: string): string[] {
  const items = useAttachments.getState().items;
  return ORDER_REFERENCE_IMAGE_SLOTS.map((slot) => items[`order:${orderId}:${slot}`])
    .filter((rec): rec is NonNullable<typeof rec> => !!rec?.filed && !!rec.fileDataUrl)
    .map((rec) => rec.fileDataUrl!);
}

function itemDescriptionFor(order: Order): string {
  const parts: string[] = [];
  if (order.item.size) parts.push(`Size: ${order.item.size}`);
  parts.push(`${order.item.metal} · ${order.item.metalColor}`);
  if (order.item.stoneDetails) parts.push(`Stones: ${order.item.stoneDetails}`);
  if (order.design.pattern) parts.push(`Pattern: ${order.design.pattern}`);
  if (order.design.designNumber) parts.push(`Design No: ${order.design.designNumber}`);
  return parts.join(" · ");
}

/**
 * Builds the print-ready data for a Production Order's Job Card.
 * `jobCard`, if the order already has one created via the workshop's
 * "Create Job Card" flow, supplies the authoritative job number and
 * assigned karigar; otherwise both are derived straight from the order
 * (job number falls back to the order number, karigar from
 * `order.karigarId`/`karigarName` if the caller has it resolved).
 */
export function buildJobCardData(
  order: Order,
  jobCard: JobCard | null | undefined,
  customerName: string,
  customerPhone: string | undefined,
  karigarNameFallback: string | null,
): JobCardPrintData {
  const qrPayload = JSON.stringify({
    type: "job_card",
    orderNo: order.orderNo,
    jobNo: jobCard?.jobNo ?? order.orderNo,
    orderId: order.id,
  });

  return {
    jobCardNo: jobCard?.jobNo ?? `JC-${order.orderNo}`,
    productionOrderNo: order.orderNo,
    customerName,
    customerPhone,
    itemName: order.item.itemName || order.item.category,
    itemDescription: itemDescriptionFor(order),
    referenceImages: referenceImagesForOrder(order.id),
    targetGrossMg: order.item.grossMg,
    targetNetMg: order.item.netMg,
    purity: order.item.purity,
    goldReceivedGrossMg: order.advance.goldGrossMg,
    goldReceivedFineMg: order.advance.goldFineMg,
    assignedWorkerName: jobCard?.karigarName ?? karigarNameFallback,
    expectedDelivery: order.expectedDelivery,
    remarks: order.design.notes || order.item.remarks,
    qrPayload,
    generatedAt: Date.now(),
  };
}
